import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  DndContext,
  DragOverlay,
  TouchSensor,
  MeasuringStrategy,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { useStore } from '../../store/useStore'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { BucketColumn, bucketSortableId } from './BucketColumn'
import { CategoryManager } from './CategoryManager'
import { completedDroppableId } from './CompletedSection'
import { TaskCardMini } from '../task/TaskCardMini'
import { bucketWidthClass } from '../../utils/bucketWidth'
import { LeftClickMouseSensor } from '../../utils/dndSensors'

interface BoardDetailViewProps {
  boardId: string
  onBack: () => void
  onOpenTask: (taskId: string) => void
}

export function BoardDetailView({ boardId, onBack, onOpenTask }: BoardDetailViewProps) {
  const board = useStore((s) => s.boards[boardId])
  const buckets = useStore(
    useShallow((s) =>
      Object.values(s.buckets)
        .filter((b) => b.boardId === boardId)
        .sort((a, b) => a.order - b.order),
    ),
  )
  const tasks = useStore((s) => s.tasks)
  const renameBoard = useStore((s) => s.renameBoard)
  const addBucket = useStore((s) => s.addBucket)
  const setPendingEditBucketId = useStore((s) => s.setPendingEditBucketId)
  const addTaskAtTop = useStore((s) => s.addTaskAtTop)
  const moveTask = useStore((s) => s.moveTask)
  const completeTask = useStore((s) => s.completeTask)
  const deleteTasksWithUndo = useStore((s) => s.deleteTasksWithUndo)
  const reorderBuckets = useStore((s) => s.reorderBuckets)
  const bucketWidth = useStore((s) => s.preferences.bucketWidth)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(board?.name ?? '')
  const [newBucketName, setNewBucketName] = useState('')
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [collapsedBucketIds, setCollapsedBucketIds] = useState<Set<string>>(new Set())

  // Mouse drags on an 8px threshold (unchanged desktop feel); touch requires a ~250ms press-and-hold
  // so a quick tap opens a task and normal scrolling isn't hijacked into a drag. Left-click only —
  // the middle/wheel button is reserved for panning across the board, not dragging.
  const sensors = useSensors(
    useSensor(LeftClickMouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  function toggleBucketCollapsed(bucketId: string) {
    setCollapsedBucketIds((prev) => {
      const next = new Set(prev)
      if (next.has(bucketId)) next.delete(bucketId)
      else next.add(bucketId)
      return next
    })
  }

  function toggleTaskSelected(taskId: string) {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  function handleBulkMove(toBucketId: string) {
    selectedTaskIds.forEach((id) => moveTask(id, toBucketId, Number.MAX_SAFE_INTEGER))
    setSelectedTaskIds(new Set())
  }

  function handleBulkComplete() {
    selectedTaskIds.forEach((id) => completeTask(id))
    setSelectedTaskIds(new Set())
  }

  function handleBulkDelete() {
    deleteTasksWithUndo(Array.from(selectedTaskIds))
    setSelectedTaskIds(new Set())
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    setActiveTaskId(tasks[id] ? id : null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Bucket reorder: dragging a bucket (its own distinct sortable id, separate from the bucket's
    // task-droppable-zone id) rather than a task.
    const draggedBucket = buckets.find((b) => bucketSortableId(b.id) === activeId)
    if (draggedBucket) {
      let targetBucketId: string | null = null
      const overAsBucket = buckets.find((b) => bucketSortableId(b.id) === overId)
      if (overAsBucket) {
        targetBucketId = overAsBucket.id
      } else if (tasks[overId]) {
        targetBucketId = tasks[overId].bucketId
      } else if (buckets.some((b) => b.id === overId)) {
        targetBucketId = overId
      }
      if (!targetBucketId) return
      const oldIndex = buckets.findIndex((b) => b.id === draggedBucket.id)
      const newIndex = buckets.findIndex((b) => b.id === targetBucketId)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
      reorderBuckets(boardId, arrayMove(buckets, oldIndex, newIndex).map((b) => b.id))
      return
    }

    const draggedTaskId = activeId
    const draggedTask = tasks[draggedTaskId]
    if (!draggedTask) return
    const draggedIsCompleted = draggedTask.status === 'completed'

    const overTask = tasks[overId]

    let toBucketId: string
    let toIsCompletedZone: boolean
    let overTaskIdForIndex: string | null = null

    if (overTask) {
      toBucketId = overTask.bucketId
      toIsCompletedZone = overTask.status === 'completed'
      overTaskIdForIndex = overTask.id
    } else if (buckets.some((b) => completedDroppableId(b.id) === overId)) {
      toBucketId = overId.slice(0, -'::completed'.length)
      toIsCompletedZone = true
    } else if (buckets.some((b) => b.id === overId)) {
      toBucketId = overId
      toIsCompletedZone = false
    } else {
      return
    }

    // Dragging never changes completion status — only checking/unchecking the checkbox does.
    if (toIsCompletedZone !== draggedIsCompleted) return

    const destinationTasks = Object.values(tasks)
      .filter(
        (t) =>
          t.bucketId === toBucketId && t.id !== draggedTaskId && (t.status === 'completed') === draggedIsCompleted,
      )
      .sort((a, b) => a.order - b.order)

    let toIndex = destinationTasks.length
    if (overTaskIdForIndex) {
      const overIndex = destinationTasks.findIndex((t) => t.id === overTaskIdForIndex)
      if (overIndex !== -1) toIndex = overIndex
    }

    moveTask(draggedTaskId, toBucketId, toIndex)
  }

  if (!board) return null

  // On touch, collapse every bucket the moment a task drag begins so the whole board fits and the
  // card can be dropped into any bucket without a long scroll. Desktop keeps its spacious layout.
  const dragCollapse = !isDesktop && activeTaskId != null

  return (
    <div className="flex h-full flex-col p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Back to boards"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            ←
          </button>
          {editingName ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                setEditingName(false)
                if (name.trim()) renameBoard(boardId, name.trim())
                else setName(board.name)
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="min-w-0 max-w-full rounded border border-gray-300 px-2 text-xl font-semibold outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          ) : (
            <h1
              className="truncate text-xl font-semibold text-gray-900 dark:text-gray-100"
              onDoubleClick={() => setEditingName(true)}
            >
              {board.name}
            </h1>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDesktop && (
            <input
              id="task-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks... (press /)"
              className="w-56 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          )}
          <button
            onClick={() => {
              setSelectMode((v) => !v)
              setSelectedTaskIds(new Set())
            }}
            className={`rounded px-3 py-1.5 text-sm ${
              selectMode
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            {selectMode ? 'Cancel' : 'Select'}
          </button>
          <button
            onClick={() => setPendingEditBucketId(addBucket(boardId, 'New bucket'))}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900"
          >
            Add bucket
          </button>
          <button
            onClick={() => {
              if (buckets.length === 0) return
              const newTaskId = addTaskAtTop(boardId, buckets[0].id)
              onOpenTask(newTaskId)
            }}
            disabled={buckets.length === 0}
            title={buckets.length === 0 ? 'Add a bucket first' : undefined}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900"
          >
            Add task
          </button>
        </div>
      </div>

      {selectMode && selectedTaskIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span>{selectedTaskIds.size} selected</span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) handleBulkMove(e.target.value)
            }}
            className="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">Move to...</option>
            {buckets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button onClick={handleBulkComplete} className="rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">
            Complete
          </button>
          <button
            onClick={handleBulkDelete}
            className="rounded px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            Delete
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={buckets.map((b) => bucketSortableId(b.id))}
          strategy={isDesktop ? horizontalListSortingStrategy : verticalListSortingStrategy}
        >
          <div className={isDesktop ? 'flex flex-1 gap-4 overflow-x-auto pb-4' : 'flex flex-1 flex-col gap-4 pb-4'}>
            {buckets.map((bucket) => (
              <BucketColumn
                key={bucket.id}
                bucket={bucket}
                onOpenTask={onOpenTask}
                searchQuery={searchQuery}
                selectMode={selectMode}
                selectedTaskIds={selectedTaskIds}
                onToggleSelect={toggleTaskSelected}
                collapsed={dragCollapse || collapsedBucketIds.has(bucket.id)}
                onToggleCollapsed={() => toggleBucketCollapsed(bucket.id)}
              />
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!newBucketName.trim()) return
                addBucket(boardId, newBucketName.trim())
                setNewBucketName('')
              }}
              className={`flex h-fit ${isDesktop ? bucketWidthClass(bucketWidth) : 'w-full'} flex-shrink-0 flex-col gap-2 rounded-lg border-2 border-dashed border-gray-300 p-3 dark:border-gray-600`}
            >
              <input
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
                placeholder="New bucket name"
                className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                type="submit"
                className="rounded bg-gray-900 px-3 py-1 text-sm text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900"
              >
                Add bucket
              </button>
            </form>
          </div>
        </SortableContext>
        <DragOverlay>
          {activeTaskId && tasks[activeTaskId] ? (
            <TaskCardMini task={tasks[activeTaskId]} onClick={() => {}} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <CategoryManager boardId={boardId} />
    </div>
  )
}
