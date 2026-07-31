import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { useAutoSyncStore, isAutoSyncSupported } from '../../store/useAutoSyncStore'
import { getLastExportAt, isBackupReminderDismissed, dismissBackupReminder } from '../../store/backupStorage'
import { AutoSyncPanel } from '../layout/AutoSyncPanel'

/**
 * A one-time, from-the-start reminder that data lives only in this browser and should be backed up.
 * Shown to users who have never exported; disappears for good once they export once, set up
 * auto-sync, or dismiss it. The recurring "last backup was N days ago" nudge (BackupNudge) takes
 * over after the first export.
 */
export function BackupReminder() {
  const hasBoards = useStore((s) => Object.keys(s.boards).length > 0)
  const exportData = useStore((s) => s.exportData)
  const autoSyncStatus = useAutoSyncStore((s) => s.status)
  const [dismissed, setDismissed] = useState(() => isBackupReminderDismissed() || getLastExportAt() != null)
  const [autoSyncOpen, setAutoSyncOpen] = useState(false)

  if (!hasBoards || dismissed || autoSyncStatus === 'connected') return null

  function close() {
    dismissBackupReminder()
    setDismissed(true)
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <span>
          Heads up: it's worth keeping your own backup now and then. Browser settings like Chrome's "Clear
          cookies and site data when you close all windows" can wipe this device's local copy without warning —
          export a backup now (the <strong>Export</strong> button is up in the top bar), install the app for more
          durable storage
          {isAutoSyncSupported &&
            ', or set up Settings → Auto-sync folder to keep a backup current automatically from then on'}
          .
        </span>
        <span className="flex items-center gap-3">
          <button
            onClick={async () => {
              await exportData()
              close()
            }}
            className="font-medium underline hover:no-underline"
          >
            Export now
          </button>
          {isAutoSyncSupported && (
            <button onClick={() => setAutoSyncOpen(true)} className="underline hover:no-underline">
              Set up auto-sync
            </button>
          )}
          <button onClick={close} className="underline hover:no-underline">
            Got it
          </button>
        </span>
      </div>
      {autoSyncOpen && <AutoSyncPanel onClose={() => setAutoSyncOpen(false)} />}
    </>
  )
}
