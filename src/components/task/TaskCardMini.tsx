import type { TaskCard } from '../../types'
import { useStore } from '../../store/useStore'
import { useTick } from '../../hooks/useTick'
import { PlayPauseButton } from './PlayPauseButton'
import { formatDuration, formatDate, isTimerLongRunning } from '../../utils/time'
import { getSemanticColors, remapCategoryColor } from '../../utils/colorPalette'

interface TaskCardMiniProps {
  task: TaskCard
  onClick: () => void
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

export function TaskCardMini({ task, onClick, selectMode, selected, onToggleSelect }: TaskCardMiniProps) {
  const category = useStore((s) => (task.categoryId ? s.categories[task.categoryId] : undefined))
  const startTimer = useStore((s) => s.startTimer)
  const pauseTimer = useStore((s) => s.pauseTimer)
  const completeTask = useStore((s) => s.completeTask)
  const uncompleteTask = useStore((s) => s.uncompleteTask)
  const updateTask = useStore((s) => s.updateTask)
  const dateFormat = useStore((s) => s.preferences.dateFormat)
  const colorMode = useStore((s) => s.preferences.colorMode)
  const showDescriptionOnCard = useStore((s) => s.preferences.showDescriptionOnCard)
  const timeTrackingEnabled = useStore((s) => s.preferences.timeTrackingEnabled)
  const hiddenFields = useStore((s) => s.preferences.hiddenFields)
  const isCompleted = task.status === 'completed'
  const categoryColor = category ? remapCategoryColor(category.color, colorMode) : undefined
  const highTagColor = getSemanticColors(colorMode).level.high
  const doneSubtasks = task.subtasks.filter((s) => s.done).length
  useTick(task.timer.isRunning, 60_000)
  const longRunning = isTimerLongRunning(task.timer)

  return (
    <div
      onClick={selectMode ? onToggleSelect : onClick}
      className={`relative flex cursor-pointer flex-col gap-1.5 rounded-md border border-gray-200 p-2.5 text-left shadow-sm hover:shadow dark:border-gray-700 ${
        !isCompleted && task.timer.isRunning
          ? longRunning
            ? 'bg-amber-50 dark:bg-amber-950/40'
            : 'bg-blue-50 dark:bg-blue-950/40'
          : 'bg-white dark:bg-gray-900'
      } ${isCompleted ? 'opacity-60' : ''}`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          updateTask(task.id, { flaggedForToday: !task.flaggedForToday })
        }}
        aria-label={task.flaggedForToday ? 'Remove from Today' : 'Flag for Today'}
        title={task.flaggedForToday ? 'Remove from Today' : 'Flag for Today'}
        className={`absolute right-2 top-2 ${
          task.flaggedForToday
            ? 'text-blue-500 dark:text-blue-400'
            : 'text-gray-300 hover:text-gray-400 dark:text-gray-600 dark:hover:text-gray-500'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={task.flaggedForToday ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="4" />
        </svg>
      </button>
      <div className="flex items-start gap-2 pr-6">
        {selectMode ? (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            aria-label={selected ? 'Deselect task' : 'Select task'}
            className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer"
          />
        ) : (
          <input
            type="checkbox"
            checked={isCompleted}
            onChange={() => (isCompleted ? uncompleteTask(task.id) : completeTask(task.id))}
            onClick={(e) => e.stopPropagation()}
            aria-label={isCompleted ? 'Mark task incomplete' : 'Mark task complete'}
            className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer"
          />
        )}
        <span
          className={`break-words text-sm font-medium text-gray-900 dark:text-gray-100 ${
            isCompleted ? 'text-gray-400 line-through dark:text-gray-500' : ''
          }`}
        >
          {task.name}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1 text-xs">
        {category && (
          <span
            className="rounded-full px-1.5 py-0.5"
            style={{ backgroundColor: `${categoryColor}33`, color: categoryColor }}
          >
            {category.name}
          </span>
        )}
        {!hiddenFields.includes('subtasks') && task.subtasks.length > 0 && (
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {doneSubtasks}/{task.subtasks.length}
          </span>
        )}
        {!hiddenFields.includes('dueDate') && task.dueDate && (
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {formatDate(task.dueDate, dateFormat)}
          </span>
        )}
        {!hiddenFields.includes('urgency') && task.urgency === 'high' && (
          <span
            className="rounded-full px-1.5 py-0.5 font-semibold"
            style={{ backgroundColor: `${highTagColor}33`, color: highTagColor }}
          >
            U
          </span>
        )}
        {!hiddenFields.includes('importance') && task.importance === 'high' && (
          <span
            className="rounded-full px-1.5 py-0.5 font-semibold"
            style={{ backgroundColor: `${highTagColor}33`, color: highTagColor }}
          >
            I
          </span>
        )}
      </div>
      {!hiddenFields.includes('description') && showDescriptionOnCard && task.description.trim() && (
        <p className="line-clamp-3 text-xs text-gray-500 dark:text-gray-400">{task.description}</p>
      )}
      {timeTrackingEnabled &&
        (isCompleted ? (
          <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
            {formatDuration(task.timer.elapsedSeconds)}
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            <PlayPauseButton
              timer={task.timer}
              onStart={() => startTimer(task.id)}
              onPause={() => pauseTimer(task.id)}
            />
            {longRunning && (
              <span title="Running for over 8 hours — you may have forgotten to pause this">⚠</span>
            )}
          </div>
        ))}
    </div>
  )
}
