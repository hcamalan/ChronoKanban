import { useGoogleDriveSyncStore } from '../../store/useGoogleDriveSyncStore'

interface GoogleDriveSyncPanelProps {
  onClose: () => void
}

export function GoogleDriveSyncPanel({ onClose }: GoogleDriveSyncPanelProps) {
  const status = useGoogleDriveSyncStore((s) => s.status)
  const lastSyncedAt = useGoogleDriveSyncStore((s) => s.lastSyncedAt)
  const newerVersionAvailable = useGoogleDriveSyncStore((s) => s.newerVersionAvailable)
  const connect = useGoogleDriveSyncStore((s) => s.connect)
  const reconnect = useGoogleDriveSyncStore((s) => s.reconnect)
  const pullLatest = useGoogleDriveSyncStore((s) => s.pullLatest)
  const disconnect = useGoogleDriveSyncStore((s) => s.disconnect)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">
          Google Drive sync <span className="text-amber-600 dark:text-amber-400">(beta)</span>
        </h3>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Keeps a file in your Google Drive automatically up to date, so opening ChronoKanban Teams on another computer
          picks up your latest data. Same newest-wins behavior as Auto-sync folder, just backed by Drive instead
          of a local folder — connecting one disconnects the other. Re-authentication ~hourly is usually silent,
          but occasionally needs one click.
        </p>
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Limited beta: this is still going through Google's app-verification process, so for now it only works
          for Google accounts that have been granted access. If Google shows you an "app isn't verified" screen
          when connecting, that's why — it isn't available to everyone yet.
        </p>

        {status === 'notConfigured' && (
          <p className="text-sm text-gray-700 dark:text-gray-200">
            Not set up yet — this needs a Google Cloud OAuth Client ID configured in the app first.
          </p>
        )}

        {status === 'unconfigured' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-700 dark:text-gray-200">Not connected.</p>
            <button
              onClick={() => void connect()}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900"
            >
              Connect Google Drive
            </button>
          </div>
        )}

        {status === 'connected' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-700 dark:text-gray-200">Connected.</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Last synced: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'never'}
            </p>
            {newerVersionAvailable && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                A newer version is available — your local changes haven't synced yet, so it wasn't pulled in
                automatically.
              </p>
            )}
            <div className="mt-1 flex gap-2">
              {newerVersionAvailable && (
                <button
                  onClick={() => void pullLatest()}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Pull latest version
                </button>
              )}
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
              Access needs to be reconnected — your browser doesn't keep this permission granted forever.
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

        {status === 'file-unavailable' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              The synced file is no longer accessible — it may have been deleted, or your access to it may have
              been removed. Reconnecting won't fix this; disconnect and set sync up again if needed.
            </p>
            <div className="mt-1 flex gap-2">
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
