import { useStore } from '../../store/useStore'
import { isTeamMode, type CollabStatus as Status } from '../../collab/collabDoc'

// Visuals per connection state. Offline is gray, not red — being offline is a normal, expected state
// for this offline-first app (edits save locally and sync on reconnect), not an error.
const STATE: Record<Status, { label: string; dot: string; title: string }> = {
  connecting: { label: 'Connecting…', dot: 'bg-amber-500', title: 'Connecting to the team server…' },
  syncing: { label: 'Syncing…', dot: 'bg-amber-500', title: 'Connected — syncing the latest changes…' },
  connected: { label: 'Live', dot: 'bg-emerald-500', title: 'Connected — changes sync in real time.' },
  offline: { label: 'Offline', dot: 'bg-gray-400', title: 'Offline — changes save locally and sync when the server is reachable again.' },
}

/** Team-mode connection indicator in the top nav. Renders nothing in the local-only app. */
export function CollabStatus() {
  const status = useStore((s) => s.collabStatus)
  if (!isTeamMode) return null

  const { label, dot, title } = STATE[status]
  return (
    <span
      title={title}
      className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}
