import { useAutoSyncStore } from '../../store/useAutoSyncStore'

interface AutoSyncPanelProps {
  onClose: () => void
}

export function AutoSyncPanel({ onClose }: AutoSyncPanelProps) {
  const status = useAutoSyncStore((s) => s.status)
  const folderName = useAutoSyncStore((s) => s.folderName)
  const lastSyncedAt = useAutoSyncStore((s) => s.lastSyncedAt)
  const chooseFolder = useAutoSyncStore((s) => s.chooseFolder)
  const reconnect = useAutoSyncStore((s) => s.reconnect)
  const disconnect = useAutoSyncStore((s) => s.disconnect)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">Auto-sync folder</h3>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Pick a folder on your computer to keep a file there in sync with your data — updated automatically as you
          make changes, and loaded back in when the file there is newer than what this browser last saw (for
          example, after using ChronoKanban Teams elsewhere pointed at the same folder).
        </p>

        {status === 'unconfigured' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-700 dark:text-gray-200">Not connected to a folder yet.</p>
            <button
              onClick={() => void chooseFolder()}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900"
            >
              Choose folder…
            </button>
          </div>
        )}

        {status === 'connected' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Connected to <strong>{folderName}</strong>.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Last synced: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'never'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Switching to a different folder that already has a sync file of its own may replace what's currently
              in the app, if that file is newer.
            </p>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => void chooseFolder()}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Change folder…
              </button>
              <button
                onClick={() => void disconnect()}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-gray-600 dark:text-red-400 dark:hover:bg-red-950"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {status === 'needs-reconnect' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Access to <strong>{folderName}</strong> needs to be reconnected — your browser doesn't keep this
              permission granted forever.
            </p>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => void reconnect()}
                className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900"
              >
                Reconnect
              </button>
              <button
                onClick={() => void disconnect()}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-gray-600 dark:text-red-400 dark:hover:bg-red-950"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
