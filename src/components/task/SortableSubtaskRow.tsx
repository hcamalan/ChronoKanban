import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Subtask } from '../../types'

interface SortableSubtaskRowProps {
  subtask: Subtask
  onToggleDone: () => void
  onRename: (text: string) => void
  onDelete: () => void
}

export function SortableSubtaskRow({ subtask, onToggleDone, onRename, onDelete }: SortableSubtaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: subtask.id })
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(subtask.text)

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="flex items-center gap-2"
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="flex-shrink-0 cursor-grab text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      <input
        type="checkbox"
        checked={subtask.done}
        onChange={onToggleDone}
        className="h-4 w-4 flex-shrink-0 cursor-pointer"
      />
      {editing ? (
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => {
            setEditing(false)
            if (text.trim()) onRename(text.trim())
            else setText(subtask.text)
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="flex-1 rounded border border-gray-300 px-1 text-sm outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      ) : (
        <span
          onDoubleClick={() => {
            setText(subtask.text)
            setEditing(true)
          }}
          className={`flex-1 text-sm ${
            subtask.done ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'
          }`}
        >
          {subtask.text}
        </span>
      )}
      <button
        onClick={onDelete}
        aria-label={`Delete sub-task ${subtask.text}`}
        className="text-xs text-gray-400 hover:text-red-500"
      >
        ×
      </button>
    </div>
  )
}
