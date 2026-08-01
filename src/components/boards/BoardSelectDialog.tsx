import { useState } from 'react'

interface BoardSelectDialogProps {
  title: string
  description?: string
  boards: { id: string; name: string }[]
  confirmLabel: string
  onConfirm: (ids: string[]) => void
  onCancel: () => void
}

/** Reusable "pick which boards" modal, used by both Export (which boards to save) and Import (which
 *  boards from a file to bring in). Storage-agnostic — it only deals with {id, name} pairs. */
export function BoardSelectDialog({ title, description, boards, confirmLabel, onConfirm, onCancel }: BoardSelectDialogProps) {
  // All selected by default, matching the previous "export/import everything" behavior.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(boards.map((b) => b.id)))

  const allSelected = selected.size === boards.length && boards.length > 0

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(boards.map((b) => b.id)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">{title}</h3>
        {description && <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{description}</p>}

        {boards.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No boards to choose from.</p>
        ) : (
          <>
            <label className="mb-2 flex items-center gap-2 border-b border-gray-200 pb-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              Select all
            </label>
            <ul className="flex-1 overflow-y-auto">
              {boards.map((b) => (
                <li key={b.id}>
                  <label className="flex items-center gap-2 py-1 text-sm text-gray-700 dark:text-gray-200">
                    <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} />
                    <span className="truncate">{b.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm([...selected])}
            disabled={selected.size === 0}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
