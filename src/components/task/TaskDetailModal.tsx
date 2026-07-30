import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useShallow } from 'zustand/react/shallow'
import { DndContext, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useStore } from '../../store/useStore'
import { CategoryPicker } from './CategoryPicker'
import { PlayPauseButton } from './PlayPauseButton'
import { AttachmentList } from './AttachmentList'
import { SortableSubtaskRow } from './SortableSubtaskRow'
import { ConfirmDialog } from '../boards/ConfirmDialog'
import { flushAllDebouncers } from '../../store/persist'
import { formatHHMM, parseHHMM } from '../../utils/time'
import { blurOnEnter, blurOnCtrlEnter } from '../../utils/keyboard'
import { buildGoogleCalendarUrl, downloadIcsFile } from '../../utils/calendarExport'
import { LeftClickMouseSensor } from '../../utils/dndSensors'
import type { Urgency, Importance, TaskStatus, RecurrenceUnit, TaskCard } from '../../types'

interface TaskDetailModalProps {
  taskId: string
  onClose: () => void
}

/** Whether the task has been edited since `snapshot` was taken (a plain, JSON-comparable object). */
function hasUnsavedChanges(snapshot: TaskCard | null, current: TaskCard | null): boolean {
  if (snapshot == null || current == null) return false
  return JSON.stringify(snapshot) !== JSON.stringify(current)
}

export function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const task = useStore((s) => s.tasks[taskId])
  const boards = useStore(useShallow((s) => Object.values(s.boards).sort((a, b) => a.order - b.order)))
  const assigneeSuggestions = useStore(
    useShallow((s) =>
      Array.from(new Set(Object.values(s.tasks).map((t) => t.assignedTo).filter((a) => a.trim() !== ''))).sort(),
    ),
  )
  const updateTask = useStore((s) => s.updateTask)
  const moveTaskToBoard = useStore((s) => s.moveTaskToBoard)
  const deleteTask = useStore((s) => s.deleteTask)
  const startTimer = useStore((s) => s.startTimer)
  const pauseTimer = useStore((s) => s.pauseTimer)
  const resetTimer = useStore((s) => s.resetTimer)
  const setElapsedTime = useStore((s) => s.setElapsedTime)
  const completeTask = useStore((s) => s.completeTask)
  const uncompleteTask = useStore((s) => s.uncompleteTask)
  const timeTrackingEnabled = useStore((s) => s.preferences.timeTrackingEnabled)
  const hiddenFields = useStore((s) => s.preferences.hiddenFields)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [elapsedText, setElapsedText] = useState(() => formatHHMM(task?.timer.elapsedSeconds ?? 0))
  const [elapsedFocused, setElapsedFocused] = useState(false)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [newSubtaskText, setNewSubtaskText] = useState('')
  const [snapshot, setSnapshot] = useState<TaskCard | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const subtaskSensors = useSensors(
    useSensor(LeftClickMouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  // Newly-created tasks (from addTaskAtTop) start with an empty name — focus it immediately so
  // typing a name works right away instead of hitting global keyboard shortcuts.
  useEffect(() => {
    if (task?.name === '') nameInputRef.current?.focus()
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Snapshot the task as it was when this task was opened, so "Discard changes" has something to
  // revert to. Re-taken whenever a different task is opened in this same modal instance.
  useEffect(() => {
    setSnapshot(useStore.getState().tasks[taskId] ?? null)
  }, [taskId])

  // Re-sync the displayed text whenever the stored elapsed time changes (timer actions, or our own
  // committed edits) — but never while the user is actively focused in the field, so it can't clobber
  // an in-progress edit.
  useEffect(() => {
    if (!elapsedFocused && task) {
      setElapsedText(formatHHMM(task.timer.elapsedSeconds))
    }
  }, [task?.timer.elapsedSeconds, elapsedFocused, task])

  // Esc discards (confirming first if something actually changed); Enter (outside a text field, no
  // confirm dialog open) saves & closes. Guards against stacking when a confirm dialog is already up.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!task) return
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key === 'Escape') {
        if (confirmingDelete) {
          setConfirmingDelete(false)
          return
        }
        if (confirmingDiscard) {
          setConfirmingDiscard(false)
          return
        }
        if (hasUnsavedChanges(snapshot, task)) {
          setConfirmingDiscard(true)
        } else {
          flushAllDebouncers()
          onClose()
        }
        return
      }

      if (e.key === 'Enter' && !isTyping && !confirmingDelete && !confirmingDiscard) {
        flushAllDebouncers()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [task, snapshot, confirmingDelete, confirmingDiscard, onClose])

  if (!task) return null

  const isCompleted = task.status === 'completed'

  const handleClose = () => {
    flushAllDebouncers()
    onClose()
  }

  function handleDiscardRequest() {
    if (hasUnsavedChanges(snapshot, task)) setConfirmingDiscard(true)
    else handleClose()
  }

  function handleDiscardConfirm() {
    if (snapshot) updateTask(taskId, snapshot)
    setConfirmingDiscard(false)
    handleClose()
  }

  function commitElapsedTime() {
    const currentDisplay = formatHHMM(task.timer.elapsedSeconds)
    if (elapsedText === currentDisplay) return // untouched — don't disturb the timer or log anything
    const parsed = parseHHMM(elapsedText)
    if (parsed == null) {
      setElapsedText(currentDisplay) // invalid — revert silently
      return
    }
    setElapsedTime(taskId, parsed)
  }

  function handleSubtaskDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = task.subtasks.findIndex((s) => s.id === active.id)
    const newIndex = task.subtasks.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    updateTask(taskId, { subtasks: arrayMove(task.subtasks, oldIndex, newIndex) })
  }

  return (
    <div
      className="fixed inset-0 z-40 flex bg-black/40 sm:items-center sm:justify-center sm:p-4"
      onClick={handleClose}
    >
      <div
        className={`h-[100dvh] w-full max-w-none overflow-y-auto rounded-none bg-white p-4 shadow-xl dark:bg-gray-900 sm:w-full sm:rounded-lg sm:p-6 ${
          maximized ? 'sm:h-[95dvh] sm:w-[95vw] sm:max-w-none' : 'sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex w-full items-start gap-2">
            <input
              type="checkbox"
              checked={isCompleted}
              onChange={() => (isCompleted ? uncompleteTask(taskId) : completeTask(taskId))}
              aria-label={isCompleted ? 'Mark task incomplete' : 'Mark task complete'}
              className="mt-2 h-4 w-4 flex-shrink-0 cursor-pointer"
            />
            <input
              ref={nameInputRef}
              value={task.name}
              onChange={(e) => updateTask(taskId, { name: e.target.value })}
              onKeyDown={blurOnEnter}
              className={`w-full rounded border border-transparent px-1 text-xl font-semibold outline-none focus:border-gray-300 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-600 ${
                isCompleted ? 'text-gray-400 line-through dark:text-gray-500' : ''
              }`}
            />
          </div>
          <div className="ml-3 flex flex-shrink-0 items-center gap-1">
            <button
              onClick={() => updateTask(taskId, { flaggedForToday: !task.flaggedForToday })}
              aria-label={task.flaggedForToday ? 'Remove from Today' : 'Flag for Today'}
              title={task.flaggedForToday ? 'Remove from Today' : 'Flag for Today'}
              className={`rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                task.flaggedForToday
                  ? 'text-blue-500 dark:text-blue-400'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
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
            <button
              onClick={() => setMaximized((v) => !v)}
              aria-label={maximized ? 'Minimize' : 'Maximize'}
              title={maximized ? 'Minimize' : 'Maximize'}
              className="hidden rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 sm:inline dark:hover:bg-gray-800"
            >
              {maximized ? '□' : '❐'}
            </button>
            <button
              onClick={handleClose}
              aria-label="Save & close"
              title="Save & close"
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            >
              ✓
            </button>
          </div>
        </div>

        {timeTrackingEnabled && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {!isCompleted && (
              <PlayPauseButton
                timer={task.timer}
                onStart={() => startTimer(taskId)}
                onPause={() => pauseTimer(taskId)}
                size="md"
              />
            )}
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              Time elapsed
              <input
                type="text"
                inputMode="numeric"
                placeholder="0:00"
                value={elapsedText}
                onChange={(e) => setElapsedText(e.target.value)}
                onFocus={() => setElapsedFocused(true)}
                onBlur={() => {
                  setElapsedFocused(false)
                  commitElapsedTime()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
                className="w-16 rounded border border-gray-300 px-2 py-1 font-mono dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
            {task.estimatedHours != null && task.estimatedHours > 0 && (
              <span
                className={`text-xs ${
                  task.timer.elapsedSeconds > task.estimatedHours * 3600
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                of {task.estimatedHours}h estimated
              </span>
            )}
            {!isCompleted && (
              <button
                onClick={() => resetTimer(taskId)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Reset
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Board
            <select
              value={task.boardId}
              onChange={(e) => moveTaskToBoard(taskId, e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Category
            <CategoryPicker
              boardId={task.boardId}
              value={task.categoryId}
              onChange={(categoryId) => updateTask(taskId, { categoryId })}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Status
            <select
              value={task.status}
              onChange={(e) => {
                const newStatus = e.target.value as TaskStatus
                if (newStatus === 'completed') {
                  completeTask(taskId)
                } else {
                  if (task.status === 'completed') uncompleteTask(taskId)
                  updateTask(taskId, { status: newStatus })
                }
              }}
              className="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="not-started">Not started</option>
              <option value="in-progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>

          {!hiddenFields.includes('assignedTo') && (
            <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
              Assigned to
              <input
                value={task.assignedTo}
                onChange={(e) => updateTask(taskId, { assignedTo: e.target.value })}
                onKeyDown={blurOnEnter}
                list="assignee-suggestions"
                className="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <datalist id="assignee-suggestions">
                {assigneeSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
          )}

          {!hiddenFields.includes('dueDate') && (
            <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
              Due date
              <input
                type="date"
                value={task.dueDate ?? ''}
                onChange={(e) => updateTask(taskId, { dueDate: e.target.value || null })}
                className="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <span className="flex flex-wrap gap-2 pt-0.5">
                <a
                  href={task.dueDate ? (buildGoogleCalendarUrl(task) ?? undefined) : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={task.dueDate ? undefined : 'Set a due date first'}
                  aria-disabled={!task.dueDate}
                  onClick={(e) => {
                    if (!task.dueDate) e.preventDefault()
                  }}
                  className={`text-xs underline ${
                    task.dueDate
                      ? 'text-blue-600 hover:no-underline dark:text-blue-400'
                      : 'cursor-not-allowed text-gray-300 dark:text-gray-600'
                  }`}
                >
                  Add to Google Calendar
                </a>
                <button
                  type="button"
                  onClick={() => downloadIcsFile(task)}
                  disabled={!task.dueDate}
                  title={task.dueDate ? undefined : 'Set a due date first'}
                  className={`text-xs underline ${
                    task.dueDate
                      ? 'text-blue-600 hover:no-underline dark:text-blue-400'
                      : 'cursor-not-allowed text-gray-300 dark:text-gray-600'
                  }`}
                >
                  Download .ics
                </button>
              </span>
            </label>
          )}

          {!hiddenFields.includes('storyPoints') && (
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Story points
            <input
              type="number"
              min={0}
              value={task.storyPoints ?? ''}
              onChange={(e) =>
                updateTask(taskId, {
                  storyPoints: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              onKeyDown={blurOnEnter}
              className="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          )}

          {!hiddenFields.includes('estimatedHours') && (
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Estimated hours
            <input
              type="number"
              min={0}
              step={0.5}
              value={task.estimatedHours ?? ''}
              onChange={(e) =>
                updateTask(taskId, {
                  estimatedHours: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              onKeyDown={blurOnEnter}
              className="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          )}

          {!hiddenFields.includes('urgency') && (
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Urgency
            <select
              value={task.urgency ?? ''}
              onChange={(e) => updateTask(taskId, { urgency: e.target.value === '' ? null : (e.target.value as Urgency) })}
              className="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">—</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          )}

          {!hiddenFields.includes('importance') && (
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Importance
            <select
              value={task.importance ?? ''}
              onChange={(e) =>
                updateTask(taskId, { importance: e.target.value === '' ? null : (e.target.value as Importance) })
              }
              className="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">—</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          )}

          {!hiddenFields.includes('dueDate') && (
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Repeat
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!task.recurrence}
                disabled={!task.dueDate}
                onChange={(e) =>
                  updateTask(taskId, {
                    recurrence: e.target.checked ? { interval: 1, unit: 'week' } : null,
                  })
                }
                className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
              />
              {task.recurrence && (
                <>
                  <input
                    type="number"
                    min={1}
                    value={task.recurrence.interval}
                    onChange={(e) =>
                      updateTask(taskId, {
                        recurrence: { interval: Math.max(1, Number(e.target.value)), unit: task.recurrence!.unit },
                      })
                    }
                    onKeyDown={blurOnEnter}
                    className="w-14 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <select
                    value={task.recurrence.unit}
                    onChange={(e) =>
                      updateTask(taskId, {
                        recurrence: { interval: task.recurrence!.interval, unit: e.target.value as RecurrenceUnit },
                      })
                    }
                    className="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="day">Day(s)</option>
                    <option value="week">Week(s)</option>
                    <option value="month">Month(s)</option>
                  </select>
                </>
              )}
            </div>
            {!task.dueDate && <span className="text-xs text-gray-400">Set a due date to enable</span>}
          </label>
          )}
        </div>

        {!hiddenFields.includes('subtasks') && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm text-gray-600 dark:text-gray-300">Sub-tasks</h3>
          <DndContext sensors={subtaskSensors} onDragEnd={handleSubtaskDragEnd}>
            <SortableContext items={task.subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1">
                {task.subtasks.map((sub) => (
                  <SortableSubtaskRow
                    key={sub.id}
                    subtask={sub}
                    onToggleDone={() =>
                      updateTask(taskId, {
                        subtasks: task.subtasks.map((s) => (s.id === sub.id ? { ...s, done: !s.done } : s)),
                      })
                    }
                    onRename={(text) =>
                      updateTask(taskId, {
                        subtasks: task.subtasks.map((s) => (s.id === sub.id ? { ...s, text } : s)),
                      })
                    }
                    onDelete={() => updateTask(taskId, { subtasks: task.subtasks.filter((s) => s.id !== sub.id) })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!newSubtaskText.trim()) return
              updateTask(taskId, {
                subtasks: [...task.subtasks, { id: crypto.randomUUID(), text: newSubtaskText.trim(), done: false }],
              })
              setNewSubtaskText('')
            }}
            className="mt-2"
          >
            <input
              value={newSubtaskText}
              onChange={(e) => setNewSubtaskText(e.target.value)}
              placeholder="+ Add sub-task"
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </form>
        </div>
        )}

        {!hiddenFields.includes('description') && (
        <>
        <div className="mt-4 flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
          Description
          {editingDescription || task.description.trim() === '' ? (
            <textarea
              value={task.description}
              autoFocus={editingDescription}
              onChange={(e) => updateTask(taskId, { description: e.target.value })}
              onBlur={() => setEditingDescription(false)}
              onKeyDown={blurOnCtrlEnter}
              rows={descriptionExpanded ? 16 : 4}
              placeholder="Add a description — markdown is supported"
              className="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          ) : (
            <div
              onClick={() => setEditingDescription(true)}
              title="Click to edit"
              className={`cursor-text overflow-y-auto rounded border border-gray-300 px-2 py-1 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 ${
                descriptionExpanded ? 'max-h-[26rem]' : 'max-h-40'
              } [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-2 [&_blockquote]:text-gray-500 [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 dark:[&_a]:text-blue-400 dark:[&_code]:bg-gray-700`}
            >
              <ReactMarkdown
                components={{
                  a: ({ node: _node, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} />
                  ),
                }}
              >
                {task.description}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => setDescriptionExpanded((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {descriptionExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
        </>
        )}

        <AttachmentList taskId={taskId} />

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={handleDiscardRequest}
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Discard changes
          </button>
          <button
            onClick={() => setConfirmingDelete(true)}
            className="rounded px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            Delete task
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          message={`Delete "${task.name}"? This cannot be undone.`}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            deleteTask(taskId)
            setConfirmingDelete(false)
            onClose()
          }}
        />
      )}

      {confirmingDiscard && (
        <ConfirmDialog
          message="Are you sure you want to discard your changes?"
          confirmLabel="Discard"
          onCancel={() => setConfirmingDiscard(false)}
          onConfirm={handleDiscardConfirm}
        />
      )}
    </div>
  )
}
