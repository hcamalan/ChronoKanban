import { useEffect, useState } from 'react'
import { getAllCheckpoints } from '../../db/repository'
import { restoreCheckpointBoardAsNewBoard, downloadCheckpoint } from '../../collab/checkpoints'
import { useStore } from '../../store/useStore'
import type { Checkpoint } from '../../types'

interface VersionHistoryModalProps {
  onClose: () => void
  onRestored: () => void
}

export function VersionHistoryModal({ onClose, onRestored }: VersionHistoryModalProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[] | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const loadFromDB = useStore((s) => s.loadFromDB)

  useEffect(() => {
    getAllCheckpoints().then((list) => setCheckpoints(list.sort((a, b) => b.createdAt - a.createdAt)))
  }, [])

  async function handleRestore(checkpoint: Checkpoint, boardId: string) {
    restoreCheckpointBoardAsNewBoard(checkpoint, boardId)
    await loadFromDB()
    onRestored()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">Version history</h3>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Automatic snapshots of your boards, kept on this device. Restoring adds a copy as a new board — it never
          changes your current boards. (Attachments aren't included in snapshots.)
        </p>

        <div className="flex-1 overflow-y-auto">
          {checkpoints === null ? (
            <p className="py-6 text-center text-sm text-gray-400">Loading…</p>
          ) : checkpoints.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              No snapshots yet — they're captured automatically as you work.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {checkpoints.map((cp) => {
                const expanded = expandedId === cp.id
                return (
                  <li key={cp.id} className="rounded border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                      <button
                        onClick={() => setExpandedId(expanded ? null : cp.id)}
                        className="flex-1 text-left text-sm text-gray-700 dark:text-gray-200"
                        aria-expanded={expanded}
                      >
                        {new Date(cp.createdAt).toLocaleString()}
                        <span className="ml-2 text-xs text-gray-400">
                          {cp.entities.boards.length} board{cp.entities.boards.length === 1 ? '' : 's'}
                        </span>
                      </button>
                      <button
                        onClick={() => downloadCheckpoint(cp)}
                        className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                      >
                        Download
                      </button>
                    </div>
                    {expanded && (
                      <ul className="border-t border-gray-100 px-2 py-1 dark:border-gray-700">
                        {cp.entities.boards.map((b) => (
                          <li key={b.id} className="flex items-center justify-between gap-2 py-1">
                            <span className="truncate text-sm text-gray-600 dark:text-gray-300">{b.name}</span>
                            <button
                              onClick={() => handleRestore(cp, b.id)}
                              className="flex-shrink-0 rounded bg-gray-900 px-2 py-0.5 text-xs font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
                            >
                              Restore as new board
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
