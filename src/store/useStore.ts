import { create } from 'zustand'
import * as repo from '../db/repository'
import { buildExportFile, downloadExportFile, replaceAllDataWithSnapshot, type ExportFile } from '../db/exportImport'
import { logActivity, downloadTimesheetCsv, purgeCurrentRunLog, type WorkInterval } from '../db/activityLog'
import { createDebouncer } from './persist'
import { loadPreferences, savePreferences } from './preferencesStorage'
import { markExported } from './backupStorage'
import { mutate, initCollab, clearDocEntities, seedExampleIntoDoc } from '../collab/collabDoc'
import { addToDateString } from '../utils/time'
import type { Board, Bucket, TaskCard, Category, Preferences } from '../types'

interface PendingDeletion {
  label: string
  timeoutId: ReturnType<typeof setTimeout>
  commit: () => void
  restore: () => void
}

// The Y.Doc (via collabDoc) is now the source of truth + persistence for entities, so text edits
// no longer need debounced IndexedDB writes. This debouncer only throttles the activity-log
// "update" entry so typing a name/description doesn't flood the log.
const debouncedLogUpdate = createDebouncer((task: TaskCard) => {
  logActivity(task.id, task.name, 'update', task.status)
}, 450)

interface AppState {
  boards: Record<string, Board>
  buckets: Record<string, Bucket>
  tasks: Record<string, TaskCard>
  categories: Record<string, Category>
  loaded: boolean
  preferences: Preferences
  pendingDeletion: PendingDeletion | null
  // Transient signal: a freshly-created bucket whose name field should auto-open + scroll into view.
  pendingEditBucketId: string | null

  loadFromDB: () => Promise<void>
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  setPendingEditBucketId: (id: string | null) => void
  undoDelete: () => void

  addBoard: (name: string) => string
  renameBoard: (id: string, name: string) => void
  deleteBoard: (id: string) => void
  reorderBoards: (orderedIds: string[]) => void
  duplicateBoard: (id: string) => string | undefined

  addBucket: (boardId: string, name: string) => string
  renameBucket: (id: string, name: string) => void
  deleteBucket: (id: string) => void
  reorderBuckets: (boardId: string, orderedIds: string[]) => void

  addTask: (boardId: string, bucketId: string, name: string) => string
  addTaskAtTop: (boardId: string, bucketId: string) => string
  updateTask: (id: string, patch: Partial<TaskCard>) => void
  deleteTask: (id: string) => void
  deleteTasksWithUndo: (ids: string[]) => void
  moveTask: (taskId: string, toBucketId: string, toIndex: number) => void
  moveTaskToBoard: (taskId: string, newBoardId: string) => void

  startTimer: (taskId: string) => void
  pauseTimer: (taskId: string) => void
  pauseAllTimers: (boardId?: string) => void
  resetTimer: (taskId: string) => void
  setElapsedTime: (taskId: string, newElapsedSeconds: number) => void

  completeTask: (taskId: string) => void
  uncompleteTask: (taskId: string) => void

  addCategory: (boardId: string, name: string, color: string) => string
  updateCategory: (id: string, patch: Partial<Category>) => void
  deleteCategory: (id: string) => void

  exportData: () => Promise<void>
  downloadActivityLog: () => Promise<void>
  deleteAllData: () => Promise<void>
  restoreFromSnapshot: (data: ExportFile) => Promise<void>
}

export const useStore = create<AppState>((set, get) => {
  function finalizePendingDeletion() {
    const pending = get().pendingDeletion
    if (!pending) return
    clearTimeout(pending.timeoutId)
    pending.commit()
    set({ pendingDeletion: null })
  }

  return {
    boards: {},
    buckets: {},
    tasks: {},
    categories: {},
    loaded: false,
    preferences: loadPreferences(),
    pendingDeletion: null,
    pendingEditBucketId: null,

    // Entity slices below are DERIVED from the Y.Doc: mutations write the doc, and collabDoc's
    // observers are the only thing that call `set()` for boards/buckets/tasks/categories.
    loadFromDB: async () => {
      await initCollab(set)
    },

    setPreference: (key, value) => {
      const preferences = { ...get().preferences, [key]: value }
      set({ preferences })
      savePreferences(preferences)
    },
    setPendingEditBucketId: (id) => set({ pendingEditBucketId: id }),
    undoDelete: () => {
      const pending = get().pendingDeletion
      if (!pending) return
      clearTimeout(pending.timeoutId)
      pending.restore()
      set({ pendingDeletion: null })
    },

    addBoard: (name) => {
      const id = crypto.randomUUID()
      const order = Object.keys(get().boards).length
      const board: Board = { id, name, order, createdAt: Date.now() }
      mutate((ops) => ops.put('boards', board))
      return id
    },
    renameBoard: (id, name) => {
      if (!get().boards[id]) return
      mutate((ops) => ops.update('boards', id, { name }))
    },
    deleteBoard: (id) => {
      const board = get().boards[id]
      if (!board) return
      finalizePendingDeletion()
      const affectedBuckets = Object.values(get().buckets).filter((b) => b.boardId === id)
      const affectedTasks = Object.values(get().tasks).filter((t) => t.boardId === id)
      const affectedCategories = Object.values(get().categories).filter((c) => c.boardId === id)
      mutate((ops) => {
        ops.delete('boards', id)
        affectedBuckets.forEach((b) => ops.delete('buckets', b.id))
        affectedTasks.forEach((t) => ops.delete('tasks', t.id))
        affectedCategories.forEach((c) => ops.delete('categories', c.id))
      })
      // Deferred, undo-unsafe parts only: clean each affected task's attachments + log the delete.
      const commit = () => {
        for (const t of affectedTasks) {
          repo.deleteTask(t.id)
          logActivity(t.id, t.name, 'delete', t.status)
        }
      }
      const timeoutId = setTimeout(() => {
        commit()
        set({ pendingDeletion: null })
      }, 6000)
      set({
        pendingDeletion: {
          label: `"${board.name}" deleted`,
          timeoutId,
          commit,
          restore: () =>
            mutate((ops) => {
              ops.put('boards', board)
              affectedBuckets.forEach((b) => ops.put('buckets', b))
              affectedTasks.forEach((t) => ops.put('tasks', t))
              affectedCategories.forEach((c) => ops.put('categories', c))
            }),
        },
      })
    },
    reorderBoards: (orderedIds) => {
      const changed: { id: string; order: number }[] = []
      orderedIds.forEach((id, index) => {
        const board = get().boards[id]
        if (board && board.order !== index) changed.push({ id, order: index })
      })
      if (changed.length === 0) return
      mutate((ops) => changed.forEach(({ id, order }) => ops.update('boards', id, { order })))
    },
    duplicateBoard: (id) => {
      const board = get().boards[id]
      if (!board) return
      const newBoardId = crypto.randomUUID()
      const newBoard: Board = {
        ...board,
        id: newBoardId,
        name: `${board.name} (copy)`,
        order: Object.keys(get().boards).length,
        createdAt: Date.now(),
      }

      const oldBuckets = Object.values(get().buckets).filter((b) => b.boardId === id)
      const bucketIdMap = new Map<string, string>()
      const newBuckets: Bucket[] = oldBuckets.map((b) => {
        const newId = crypto.randomUUID()
        bucketIdMap.set(b.id, newId)
        return { ...b, id: newId, boardId: newBoardId }
      })

      const oldCategories = Object.values(get().categories).filter((c) => c.boardId === id)
      const categoryIdMap = new Map<string, string>()
      const newCategories: Category[] = oldCategories.map((c) => {
        const newId = crypto.randomUUID()
        categoryIdMap.set(c.id, newId)
        return { ...c, id: newId, boardId: newBoardId }
      })

      const oldTasks = Object.values(get().tasks).filter((t) => t.boardId === id)
      const newTasks: TaskCard[] = oldTasks.map((t) => ({
        ...t,
        id: crypto.randomUUID(),
        boardId: newBoardId,
        bucketId: bucketIdMap.get(t.bucketId) ?? t.bucketId,
        categoryId: t.categoryId ? (categoryIdMap.get(t.categoryId) ?? null) : null,
        status: 'not-started',
        completedAt: null,
        timer: { isRunning: false, elapsedSeconds: 0, startedAt: null },
        createdAt: Date.now(),
        subtasks: t.subtasks.map((s) => ({ ...s, id: crypto.randomUUID() })),
      }))

      mutate((ops) => {
        ops.put('boards', newBoard)
        newBuckets.forEach((b) => ops.put('buckets', b))
        newCategories.forEach((c) => ops.put('categories', c))
        newTasks.forEach((t) => ops.put('tasks', t))
      })
      return newBoardId
    },

    addBucket: (boardId, name) => {
      const id = crypto.randomUUID()
      const order = Object.values(get().buckets).filter((b) => b.boardId === boardId).length
      const bucket: Bucket = { id, boardId, name, order }
      mutate((ops) => ops.put('buckets', bucket))
      return id
    },
    renameBucket: (id, name) => {
      if (!get().buckets[id]) return
      mutate((ops) => ops.update('buckets', id, { name }))
    },
    deleteBucket: (id) => {
      const bucket = get().buckets[id]
      if (!bucket) return
      finalizePendingDeletion()
      const affectedTasks = Object.values(get().tasks).filter((t) => t.bucketId === id)
      mutate((ops) => {
        ops.delete('buckets', id)
        affectedTasks.forEach((t) => ops.delete('tasks', t.id))
      })
      const commit = () => {
        for (const t of affectedTasks) {
          repo.deleteTask(t.id)
          logActivity(t.id, t.name, 'delete', t.status)
        }
      }
      const timeoutId = setTimeout(() => {
        commit()
        set({ pendingDeletion: null })
      }, 6000)
      set({
        pendingDeletion: {
          label: `"${bucket.name}" deleted`,
          timeoutId,
          commit,
          restore: () =>
            mutate((ops) => {
              ops.put('buckets', bucket)
              affectedTasks.forEach((t) => ops.put('tasks', t))
            }),
        },
      })
    },
    reorderBuckets: (boardId, orderedIds) => {
      const changed: { id: string; order: number }[] = []
      orderedIds.forEach((id, index) => {
        const bucket = get().buckets[id]
        if (bucket && bucket.boardId === boardId && bucket.order !== index) changed.push({ id, order: index })
      })
      if (changed.length === 0) return
      mutate((ops) => changed.forEach(({ id, order }) => ops.update('buckets', id, { order })))
    },

    addTask: (boardId, bucketId, name) => {
      const id = crypto.randomUUID()
      const order = Object.values(get().tasks).filter((t) => t.bucketId === bucketId).length
      const task: TaskCard = {
        id,
        boardId,
        bucketId,
        name,
        categoryId: null,
        status: 'not-started',
        assignedTo: '',
        dueDate: null,
        urgency: null,
        importance: null,
        description: '',
        storyPoints: null,
        estimatedHours: null,
        subtasks: [],
        recurrence: null,
        order,
        timer: { isRunning: false, elapsedSeconds: 0, startedAt: null },
        createdAt: Date.now(),
        completedAt: null,
        flaggedForToday: false,
      }
      mutate((ops) => ops.put('tasks', task))
      logActivity(id, name, 'create', task.status)
      return id
    },
    addTaskAtTop: (boardId, bucketId) => {
      const id = crypto.randomUUID()
      const task: TaskCard = {
        id,
        boardId,
        bucketId,
        name: '',
        categoryId: null,
        status: 'not-started',
        assignedTo: '',
        dueDate: null,
        urgency: null,
        importance: null,
        description: '',
        storyPoints: null,
        estimatedHours: null,
        subtasks: [],
        recurrence: null,
        order: 0,
        timer: { isRunning: false, elapsedSeconds: 0, startedAt: null },
        createdAt: Date.now(),
        completedAt: null,
        flaggedForToday: false,
      }
      // Shift every other active task in this bucket down by one to make room at the top.
      const shifted = Object.values(get().tasks).filter((t) => t.bucketId === bucketId && t.status !== 'completed')
      mutate((ops) => {
        ops.put('tasks', task)
        shifted.forEach((t) => ops.update('tasks', t.id, { order: t.order + 1 }))
      })
      logActivity(id, task.name, 'create', task.status)
      return id
    },
    updateTask: (id, patch) => {
      if (!get().tasks[id]) return
      mutate((ops) => ops.update('tasks', id, patch))
      const updated = get().tasks[id]
      if (!updated) return
      if ('name' in patch || 'description' in patch) {
        debouncedLogUpdate(id, () => get().tasks[id])
      } else {
        logActivity(id, updated.name, 'status' in patch ? 'status-change' : 'update', updated.status)
      }
    },
    deleteTask: (id) => {
      const task = get().tasks[id]
      if (!task) return
      finalizePendingDeletion()
      mutate((ops) => ops.delete('tasks', id))
      const commit = () => {
        repo.deleteTask(id)
        logActivity(id, task.name, 'delete', task.status)
      }
      const timeoutId = setTimeout(() => {
        commit()
        set({ pendingDeletion: null })
      }, 6000)
      set({
        pendingDeletion: {
          label: `"${task.name}" deleted`,
          timeoutId,
          commit,
          restore: () => mutate((ops) => ops.put('tasks', task)),
        },
      })
    },
    deleteTasksWithUndo: (ids) => {
      const tasksToDelete = ids.map((id) => get().tasks[id]).filter((t): t is TaskCard => !!t)
      if (tasksToDelete.length === 0) return
      finalizePendingDeletion()
      mutate((ops) => tasksToDelete.forEach((t) => ops.delete('tasks', t.id)))
      const commit = () => {
        for (const t of tasksToDelete) {
          repo.deleteTask(t.id)
          logActivity(t.id, t.name, 'delete', t.status)
        }
      }
      const timeoutId = setTimeout(() => {
        commit()
        set({ pendingDeletion: null })
      }, 6000)
      set({
        pendingDeletion: {
          label: `${tasksToDelete.length} task${tasksToDelete.length === 1 ? '' : 's'} deleted`,
          timeoutId,
          commit,
          restore: () => mutate((ops) => tasksToDelete.forEach((t) => ops.put('tasks', t))),
        },
      })
    },
    moveTask: (taskId, toBucketId, toIndex) => {
      const state = get()
      const task = state.tasks[taskId]
      if (!task) return
      const fromBucketId = task.bucketId
      const isCompleted = task.status === 'completed'

      // Active and completed tasks keep separate order sequences within a bucket.
      const targetTasks = Object.values(state.tasks)
        .filter((t) => t.bucketId === toBucketId && t.id !== taskId && (t.status === 'completed') === isCompleted)
        .sort((a, b) => a.order - b.order)
      targetTasks.splice(toIndex, 0, task)

      const remaining =
        fromBucketId !== toBucketId
          ? Object.values(state.tasks)
              .filter(
                (t) =>
                  t.bucketId === fromBucketId &&
                  t.id !== taskId &&
                  (t.status === 'completed') === isCompleted,
              )
              .sort((a, b) => a.order - b.order)
          : []

      mutate((ops) => {
        targetTasks.forEach((t, index) => ops.update('tasks', t.id, { bucketId: toBucketId, order: index }))
        remaining.forEach((t, index) => {
          if (t.order !== index) ops.update('tasks', t.id, { order: index })
        })
      })

      if (fromBucketId !== toBucketId) logActivity(taskId, task.name, 'move', task.status)
    },
    moveTaskToBoard: (taskId, newBoardId) => {
      const task = get().tasks[taskId]
      if (!task) return
      const targetBuckets = Object.values(get().buckets)
        .filter((b) => b.boardId === newBoardId)
        .sort((a, b) => a.order - b.order)
      if (targetBuckets.length === 0) return
      const newBucketId = targetBuckets[0].id
      const order = Object.values(get().tasks).filter((t) => t.bucketId === newBucketId).length
      mutate((ops) => ops.update('tasks', taskId, { boardId: newBoardId, bucketId: newBucketId, categoryId: null, order }))
      logActivity(taskId, task.name, 'move', task.status)
    },

    startTimer: (taskId) => {
      const task = get().tasks[taskId]
      if (!task || task.timer.isRunning) return
      const status = task.status === 'not-started' ? 'in-progress' : task.status
      const timer = { ...task.timer, isRunning: true, startedAt: Date.now() }
      mutate((ops) => ops.update('tasks', taskId, { status, timer }))
      logActivity(taskId, task.name, 'timer-start', status)
    },
    pauseTimer: (taskId) => {
      const task = get().tasks[taskId]
      if (!task || !task.timer.isRunning || task.timer.startedAt == null) return
      const segmentStart = task.timer.startedAt
      const elapsedSeconds = task.timer.elapsedSeconds + (Date.now() - segmentStart) / 1000
      mutate((ops) => ops.update('tasks', taskId, { timer: { isRunning: false, elapsedSeconds, startedAt: null } }))
      logActivity(taskId, task.name, 'timer-pause', task.status, segmentStart)
    },
    pauseAllTimers: (boardId) => {
      Object.values(get().tasks)
        .filter((t) => t.timer.isRunning && (boardId == null || t.boardId === boardId))
        .forEach((t) => get().pauseTimer(t.id))
    },
    resetTimer: (taskId) => {
      const task = get().tasks[taskId]
      if (!task) return
      mutate((ops) => ops.update('tasks', taskId, { timer: { isRunning: false, elapsedSeconds: 0, startedAt: null } }))
      // Undo only the current run's logged time — purge before logging the reset entry.
      purgeCurrentRunLog(taskId, task.createdAt).then(() => {
        logActivity(taskId, task.name, 'timer-reset', task.status)
      })
    },
    setElapsedTime: (taskId, newElapsedSeconds) => {
      const task = get().tasks[taskId]
      if (!task) return

      // If running, close out the real segment first (logged like a normal pause), so the delta is
      // only the manual correction on top of genuinely tracked time.
      let baseElapsed = task.timer.elapsedSeconds
      if (task.timer.isRunning && task.timer.startedAt != null) {
        const segmentStart = task.timer.startedAt
        baseElapsed += (Date.now() - segmentStart) / 1000
        logActivity(taskId, task.name, 'timer-pause', task.status, segmentStart)
      }

      const delta = newElapsedSeconds - baseElapsed
      mutate((ops) =>
        ops.update('tasks', taskId, { timer: { isRunning: false, elapsedSeconds: newElapsedSeconds, startedAt: null } }),
      )
      if (delta !== 0) {
        logActivity(taskId, task.name, 'manual-adjustment', task.status, undefined, delta)
      }
    },

    completeTask: (taskId) => {
      const task = get().tasks[taskId]
      if (!task) return
      let timer = task.timer
      let segmentStart: number | undefined
      if (timer.isRunning && timer.startedAt != null) {
        segmentStart = timer.startedAt
        const elapsedSeconds = timer.elapsedSeconds + (Date.now() - segmentStart) / 1000
        timer = { isRunning: false, elapsedSeconds, startedAt: null }
      }
      const completedAt = Date.now()

      // Spawn the next occurrence up-front (if recurring) so it lands in the same transaction.
      let nextTask: TaskCard | null = null
      if (task.recurrence && task.dueDate) {
        nextTask = {
          ...task,
          id: crypto.randomUUID(),
          status: 'not-started',
          completedAt: null,
          dueDate: addToDateString(task.dueDate, task.recurrence.interval, task.recurrence.unit),
          timer: { isRunning: false, elapsedSeconds: 0, startedAt: null },
          createdAt: Date.now(),
          subtasks: task.subtasks.map((s) => ({ ...s, id: crypto.randomUUID(), done: false })),
        }
      }

      mutate((ops) => {
        ops.update('tasks', taskId, { status: 'completed', completedAt, timer })
        if (nextTask) ops.put('tasks', nextTask)
      })
      logActivity(taskId, task.name, 'status-change', 'completed', segmentStart)
      if (nextTask) logActivity(nextTask.id, nextTask.name, 'create', nextTask.status)
    },
    uncompleteTask: (taskId) => {
      const task = get().tasks[taskId]
      if (!task) return
      mutate((ops) => ops.update('tasks', taskId, { status: 'not-started', completedAt: null }))
      logActivity(taskId, task.name, 'status-change', 'not-started')
    },

    addCategory: (boardId, name, color) => {
      const id = crypto.randomUUID()
      const category: Category = { id, boardId, name, color }
      mutate((ops) => ops.put('categories', category))
      return id
    },
    updateCategory: (id, patch) => {
      if (!get().categories[id]) return
      mutate((ops) => ops.update('categories', id, patch))
    },
    deleteCategory: (id) => {
      const affectedTaskIds = Object.values(get().tasks)
        .filter((t) => t.categoryId === id)
        .map((t) => t.id)
      mutate((ops) => {
        ops.delete('categories', id)
        affectedTaskIds.forEach((tid) => ops.update('tasks', tid, { categoryId: null }))
      })
    },

    exportData: async () => {
      const data = await buildExportFile()
      downloadExportFile(data)
      markExported()
    },
    downloadActivityLog: async () => {
      const now = Date.now()
      const runningIntervals: WorkInterval[] = Object.values(get().tasks)
        .filter((t) => t.timer.isRunning && t.timer.startedAt != null)
        .map((t) => ({ taskId: t.id, taskName: t.name, start: t.timer.startedAt as number, end: now }))
      await downloadTimesheetCsv(runningIntervals)
    },
    deleteAllData: async () => {
      const pending = get().pendingDeletion
      if (pending) clearTimeout(pending.timeoutId)
      clearDocEntities()
      await repo.clearAllData()
      // Always restores the default example board so this never leaves the app on a blank screen.
      seedExampleIntoDoc()
      set({ pendingDeletion: null })
    },
    restoreFromSnapshot: async (data) => {
      const pending = get().pendingDeletion
      if (pending) clearTimeout(pending.timeoutId)
      await replaceAllDataWithSnapshot(data)
      set({ pendingDeletion: null })
    },
  }
})
