import { useEffect, useState } from 'react'

const DISMISS_KEY = 'chrono-kanban-install-dismissed'

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

/**
 * Nudges the user to install the PWA. On Chromium it triggers the native install prompt captured in
 * main.tsx; on iOS Safari (which has no such API) it shows the manual "Add to Home Screen" steps.
 * Hidden once installed (standalone) or dismissed.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    () => window.deferredInstallPrompt ?? null,
  )
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === 'true')

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setDeferred(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (dismissed || isStandalone()) return null

  const iosEligible = isIos()
  if (!deferred && !iosEligible) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    window.deferredInstallPrompt = undefined
    setDeferred(null)
    dismiss()
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
      {deferred ? (
        <>
          <span>Install ChronoKanban Teams as an app for one-tap access and offline use.</span>
          <span className="flex items-center gap-3">
            <button onClick={install} className="font-medium underline hover:no-underline">
              Install
            </button>
            <button onClick={dismiss} className="underline hover:no-underline">
              Not now
            </button>
          </span>
        </>
      ) : (
        <>
          <span>
            Install this as an app: tap the Share icon, then <strong>Add to Home Screen</strong>.
          </span>
          <button onClick={dismiss} className="underline hover:no-underline">
            Got it
          </button>
        </>
      )}
    </div>
  )
}
