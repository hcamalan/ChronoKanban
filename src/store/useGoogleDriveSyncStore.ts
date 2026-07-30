import { create } from 'zustand'
import { useStore } from './useStore'
import { useAutoSyncStore } from './useAutoSyncStore'
import { buildExportFile, parseImportFile } from '../db/exportImport'
import { createDebouncer } from './persist'
import { getAccessToken, clearAccessToken } from '../db/googleDriveAuth'
import {
  findOrCreateFolder,
  findSyncFile,
  getFileModifiedTime,
  downloadFileContent,
  writeFileContent,
  isFileGoneError,
} from '../db/googleDriveApi'
import {
  getDriveIds,
  saveDriveIds,
  clearDriveIds,
  getDriveLastSyncedAt,
  setDriveLastSyncedAt,
  getDriveWasConnected,
  setDriveWasConnected,
} from '../db/googleDriveStorage'
import { isGoogleDriveConfigured } from '../config/googleDrive'

const POLL_INTERVAL_MS = 2 * 60 * 1000

export type GoogleDriveSyncStatus =
  | 'notConfigured'
  | 'unconfigured'
  | 'connected'
  | 'needs-reconnect'
  | 'file-unavailable'

interface GoogleDriveSyncState {
  status: GoogleDriveSyncStatus
  lastSyncedAt: string | null
  newerVersionAvailable: boolean
  init: () => Promise<void>
  connect: () => Promise<void>
  reconnect: () => Promise<void>
  pullLatest: () => Promise<void>
  disconnect: () => Promise<void>
}

let folderId: string | null = null
let fileId: string | null = null
let hasUnpushedChanges = false
let unwatchStore: (() => void) | null = null
let pollIntervalId: ReturnType<typeof setInterval> | null = null

/** Background/automatic push — never shows an interactive popup, since it can fire mid-edit. */
async function pushSnapshot() {
  if (!folderId && !fileId) return
  let token: string
  try {
    token = await getAccessToken({ silent: true })
  } catch {
    useGoogleDriveSyncStore.setState({ status: 'needs-reconnect' })
    return
  }
  try {
    const data = await buildExportFile()
    const result = await writeFileContent(token, folderId, fileId, JSON.stringify(data, null, 2))
    fileId = result.id
    await saveDriveIds(folderId, fileId)
    await setDriveLastSyncedAt(result.modifiedTime)
    hasUnpushedChanges = false
    useGoogleDriveSyncStore.setState({ lastSyncedAt: result.modifiedTime, newerVersionAvailable: false })
  } catch (err) {
    if (isFileGoneError(err)) {
      stopPolling()
      useGoogleDriveSyncStore.setState({ status: 'file-unavailable' })
    }
  }
}

const debouncedPush = createDebouncer<true>(() => {
  void pushSnapshot()
}, 3000)

function watchStoreForChanges() {
  unwatchStore?.()
  unwatchStore = useStore.subscribe((curr, prev) => {
    if (
      curr.boards !== prev.boards ||
      curr.buckets !== prev.buckets ||
      curr.tasks !== prev.tasks ||
      curr.categories !== prev.categories
    ) {
      hasUnpushedChanges = true
      debouncedPush('google-drive-sync', () => true)
    }
  })
}

async function pullSnapshot(token: string, modifiedTime: string) {
  if (!fileId) return
  const text = await downloadFileContent(token, fileId)
  const file = new File([text], 'chronokanban-sync.json', { type: 'application/json' })
  const data = await parseImportFile(file)
  await useStore.getState().restoreFromSnapshot(data)
  await setDriveLastSyncedAt(modifiedTime)
  hasUnpushedChanges = false
  useGoogleDriveSyncStore.setState({ lastSyncedAt: modifiedTime, newerVersionAvailable: false })
}

/** Decides whether to pull (Drive has something newer we haven't seen) or push (we're at least as current). */
async function syncOnConnect(token: string) {
  if (fileId) {
    const currentModifiedTime = await getFileModifiedTime(token, fileId)
    const lastKnown = await getDriveLastSyncedAt()
    if (!lastKnown || currentModifiedTime > lastKnown) {
      await pullSnapshot(token, currentModifiedTime)
      return
    }
  }
  await pushSnapshot()
}

function stopPolling() {
  if (pollIntervalId) clearInterval(pollIntervalId)
  pollIntervalId = null
}

function startPolling() {
  stopPolling()
  pollIntervalId = setInterval(() => {
    void poll()
  }, POLL_INTERVAL_MS)
}

/** Background poll — silent only, never shows a popup; a truly stale token surfaces via the next explicit action. */
async function poll() {
  if (document.visibilityState !== 'visible') return
  if (!fileId) return
  try {
    const token = await getAccessToken({ silent: true })
    const currentModifiedTime = await getFileModifiedTime(token, fileId)
    const lastKnown = await getDriveLastSyncedAt()
    if (lastKnown && currentModifiedTime <= lastKnown) return

    if (hasUnpushedChanges) {
      useGoogleDriveSyncStore.setState({ newerVersionAvailable: true })
    } else {
      await pullSnapshot(token, currentModifiedTime)
    }
  } catch (err) {
    if (isFileGoneError(err)) {
      stopPolling()
      useGoogleDriveSyncStore.setState({ status: 'file-unavailable' })
    }
    // Otherwise a transient failure — next poll retries; an explicit action will surface needs-reconnect if truly stale.
  }
}

async function finishConnecting() {
  if (folderId && fileId) {
    await saveDriveIds(folderId, fileId)
  }
  await setDriveWasConnected(true)
  watchStoreForChanges()
  startPolling()
  useGoogleDriveSyncStore.setState({ status: 'connected', lastSyncedAt: (await getDriveLastSyncedAt()) ?? null })
}

export const useGoogleDriveSyncStore = create<GoogleDriveSyncState>((set) => ({
  status: isGoogleDriveConfigured ? 'unconfigured' : 'notConfigured',
  lastSyncedAt: null,
  newerVersionAvailable: false,

  init: async () => {
    if (!isGoogleDriveConfigured) return
    const wasConnected = await getDriveWasConnected()
    if (!wasConnected) return

    const ids = await getDriveIds()
    if (ids) {
      folderId = ids.folderId
      fileId = ids.fileId
    }

    try {
      const token = await getAccessToken({ silent: true })
      if (!fileId) {
        // Shouldn't normally happen (wasConnected implies ids were already saved) — fall back safely.
        if (!folderId) folderId = await findOrCreateFolder(token)
        fileId = await findSyncFile(token, folderId)
      }
      await syncOnConnect(token)
      await finishConnecting()
    } catch (err) {
      set({ status: isFileGoneError(err) ? 'file-unavailable' : 'needs-reconnect' })
    }
  },

  /** Creates (or reuses) the app's own "ChronoKanban" folder + file. */
  connect: async () => {
    if (!isGoogleDriveConfigured) return
    if (useAutoSyncStore.getState().status === 'connected') {
      await useAutoSyncStore.getState().disconnect()
    }
    const token = await getAccessToken({ silent: false })
    folderId = await findOrCreateFolder(token)
    fileId = await findSyncFile(token, folderId)
    await syncOnConnect(token)
    await finishConnecting()
  },

  reconnect: async () => {
    try {
      const token = await getAccessToken({ silent: false })
      await syncOnConnect(token)
      await finishConnecting()
    } catch (err) {
      set({ status: isFileGoneError(err) ? 'file-unavailable' : 'needs-reconnect' })
    }
  },

  pullLatest: async () => {
    if (!fileId) return
    try {
      let token: string
      try {
        token = await getAccessToken({ silent: true })
      } catch {
        token = await getAccessToken({ silent: false })
      }
      const modifiedTime = await getFileModifiedTime(token, fileId)
      await pullSnapshot(token, modifiedTime)
    } catch (err) {
      if (isFileGoneError(err)) {
        stopPolling()
        set({ status: 'file-unavailable' })
      }
    }
  },

  disconnect: async () => {
    stopPolling()
    unwatchStore?.()
    unwatchStore = null
    folderId = null
    fileId = null
    hasUnpushedChanges = false
    clearAccessToken()
    await clearDriveIds()
    await setDriveWasConnected(false)
    set({ status: 'unconfigured', lastSyncedAt: null, newerVersionAvailable: false })
  },
}))
