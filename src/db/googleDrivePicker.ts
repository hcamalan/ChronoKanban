import { GOOGLE_API_KEY, GOOGLE_APP_ID } from '../config/googleDrive'

const GAPI_SCRIPT_SRC = 'https://apis.google.com/js/api.js'

let gapiScriptPromise: Promise<void> | null = null
let pickerLoadPromise: Promise<void> | null = null

function loadGapiScript(): Promise<void> {
  if (gapiScriptPromise) return gapiScriptPromise
  gapiScriptPromise = new Promise((resolve, reject) => {
    if (window.gapi) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = GAPI_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google API loader'))
    document.head.appendChild(script)
  })
  return gapiScriptPromise
}

async function loadPicker(): Promise<void> {
  if (pickerLoadPromise) return pickerLoadPromise
  pickerLoadPromise = (async () => {
    await loadGapiScript()
    if (window.google?.picker) return
    await new Promise<void>((resolve) => {
      window.gapi!.load('picker', { callback: () => resolve() })
    })
  })()
  return pickerLoadPromise
}

export interface PickedFile {
  fileId: string
  fileName: string
}

/** Opens Google's file picker (scoped to JSON files) so the user can select a file shared with them. Resolves `null` if they cancel. */
export async function openPicker(token: string): Promise<PickedFile | null> {
  await loadPicker()
  if (!window.google?.picker) throw new Error('Google Picker failed to load')
  const picker = window.google.picker

  return new Promise((resolve) => {
    // Two views so the joiner can find the file whether it's in their own Drive or (the usual
    // team case) shared with them by whoever created it.
    const myDriveView = new picker.DocsView(picker.ViewId.DOCS)
      .setOwnedByMe(true)
      .setMimeTypes('application/json')
    const sharedView = new picker.DocsView(picker.ViewId.DOCS)
      .setOwnedByMe(false)
      .setMimeTypes('application/json')
    const builder = new picker.PickerBuilder()
      .addView(myDriveView)
      .addView(sharedView)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      // Required for the app to actually get drive.file access to a file the user picks but
      // didn't create (e.g. one a teammate shared with them) — without it the follow-up Drive
      // call to that file 404s.
      .setAppId(GOOGLE_APP_ID)
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED && data.docs?.[0]) {
          resolve({ fileId: data.docs[0].id, fileName: data.docs[0].name })
        } else if (data.action === picker.Action.CANCEL) {
          resolve(null)
        }
      })
      .build()
    builder.setVisible(true)
  })
}
