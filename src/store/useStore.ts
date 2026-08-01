import { create } from 'zustand'
import * as repo from '../db/repository'
import { buildExportFile, downloadExportFile, filterExportToBoards, replaceAllDataWithSnapshot, type ExportFile } from '../db/exportImport'
import { logActivity, downloadTimesheetCsv, purgeCurrentRunLog, type WorkInterval } from '../db/activityLog'
import { createDebouncer } from './persist'
import { loadPreferences, savePreferences } from './preferencesStorage'
import { markExported } from './backupStorage'
import { hasSeededExampleBefore, seedExampleBoard } from '../db/exampleBoard'
import { addToDateString } from '../utils/time'
import type { Board, Bucket, TaskCard, Category, Preferences } from '../types'

interface PendingDeletion {
  label: string
  timeoutId: ReturnType<typeof setTimeout>
  commit: () => void
  restore: () => void
}

const debouncedPutTask = createDebouncer((task: TaskCard) => {
  repo.putTask(task)
  logActivity(task.id, task.name, 'update', task.status)
}, 450)
const debouncedPutBoard = createDebouncer(repo.putBoard, 450)
const debouncedPutBucket = createDebouncer(repo.putBucket, 450)
const debouncedPutCategory = createDebouncer(repo.putCategory, 450)

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

  exportData: (boardIds?: string[]) => Promise<void>
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

  loadFromDB: async () => {
    const [boards, buckets, tasks, categories] = await Promise.all([
      repo.getAllBoards(),
      repo.getAllBuckets(),
      repo.getAllTasks(),
      repo.getAllCategories(),
    ])

    // First-ever visit with nothing in the database yet — seed the example board so the app
    // never opens to a blank screen. Skipped if the example was already seeded before (even if
    // the user has since deleted it, or all their boards) — only "Delete all my data" reseeds.
    if (boards.length === 0 && !hasSeededExampleBefore()) {
      const seeded = await seedExampleBoard()
      set({ ...seeded, loaded: true })
      return
    }

    set({
      boards: Object.fromEntries(boards.map((b) => [b.id, b])),
      buckets: Object.fromEntries(buckets.map((b) => [b.id, b])),
      // Tasks persisted before newer fields existed lack them entirely — backfill defaults.
      tasks: Object.fromEntries(
        tasks.map((t) => [
          t.id,
          { ...t, estimatedHours: t.estimatedHours ?? null, flaggedForToday: t.flaggedForToday ?? false },
        ]),
      ),
      categories: Object.fromEntries(categories.map((c) => [c.id, c])),
      loaded: true,
    })
  },

  addBoard: (name) => {
    const id = crypto.randomUUID()
    const order = Object.keys(get().boards).length
    const board: Board = { id, name, order, createdAt: Date.now() }
    set((state) => ({ boards: { ...state.boards, [id]: board } }))
    repo.putBoard(board)
    return id
  },
  renameBoard: (id, name) => {
    set((state) => {
      const board = state.boards[id]
      if (!board) return state
      return { boards: { ...state.boards, [id]: { ...board, name } } }
    })
    debouncedPutBoard(id, () => get().boards[id])
  },
  deleteBoard: (id) => {
    const board = get().boards[id]
    if (!board) return
    finalizePendingDeletion()
    const affectedBuckets = Object.values(get().buckets).filter((b) => b.boardId === id)
    const affectedTasks = Object.values(get().tasks).filter((t) => t.boardId === id)
    const affectedCategories = Object.values(get().categories).filter((c) => c.boardId === id)
    set((state) => {
      const boards = { ...state.boards }
      delete boards[id]
      const buckets = Object.fromEntries(Object.entries(state.buckets).filter(([, b]) => b.boardId !== id))
      const tasks = Object.fromEntries(Object.entries(state.tasks).filter(([, t]) => t.boardId !== id))
      const categories = Object.fromEntries(Object.entries(state.categories).filter(([, c]) => c.boardId !== id))
      return { boards, buckets, tasks, categories }
    })
    const commit = () => {
      repo.deleteBoardCascade(id)
      for (const t of affectedTasks) logActivity(t.id, t.name, 'delete', t.status)
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
          set((state) => ({
            boards: { ...state.boards, [id]: board },
            buckets: { ...state.buckets, ...Object.fromEntries(affectedBuckets.map((b) => [b.id, b])) },
            tasks: { ...state.tasks, ...Object.fromEntries(affectedTasks.map((t) => [t.id, t])) },
            categories: { ...state.categories, ...Object.fromEntries(affectedCategories.map((c) => [c.id, c])) },
          })),
      },
    })
  },
  reorderBoards: (orderedIds) => {
    const updates: Record<string, Board> = {}
    orderedIds.forEach((id, index) => {
      const board = get().boards[id]
      if (board && board.order !== index) updates[id] = { ...board, order: index }
    })
    if (Object.keys(updates).length === 0) return
    set((state) => ({ boards: { ...state.boards, ...updates } }))
    Object.values(updates).forEach((b) => repo.putBoard(b))
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

    set((state) => ({
      boards: { ...state.boards, [newBoardId]: newBoard },
      buckets: { ...state.buckets, ...Object.fromEntries(newBuckets.map((b) => [b.id, b])) },
      categories: { ...state.categories, ...Object.fromEntries(newCategories.map((c) => [c.id, c])) },
      tasks: { ...state.tasks, ...Object.fromEntries(newTasks.map((t) => [t.id, t])) },
    }))
    repo.putBoard(newBoard)
    newBuckets.forEach((b) => repo.putBucket(b))
    newCategories.forEach((c) => repo.putCategory(c))
    newTasks.forEach((t) => repo.putTask(t))
    return newBoardId
  },

  addBucket: (boardId, name) => {
    const id = crypto.randomUUID()
    const order = Object.values(get().buckets).filter((b) => b.boardId === boardId).length
    const bucket: Bucket = { id, boardId, name, order }
    set((state) => ({ buckets: { ...state.buckets, [id]: bucket } }))
    repo.putBucket(bucket)
    return id
  },
  renameBucket: (id, name) => {
    set((state) => {
      const bucket = state.buckets[id]
      if (!bucket) return state
      return { buckets: { ...state.buckets, [id]: { ...bucket, name } } }
    })
    debouncedPutBucket(id, () => get().buckets[id])
  },
  deleteBucket: (id) => {
    const bucket = get().buckets[id]
    if (!bucket) return
    finalizePendingDeletion()
    const affectedTasks = Object.values(get().tasks).filter((t) => t.bucketId === id)
    set((state) => {
      const buckets = { ...state.buckets }
      delete buckets[id]
      const tasks = Object.fromEntries(Object.entries(state.tasks).filter(([, t]) => t.bucketId !== id))
      return { buckets, tasks }
    })
    const commit = () => {
      repo.deleteBucketCascade(id)
      for (const t of affectedTasks) logActivity(t.id, t.name, 'delete', t.status)
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
          set((state) => ({
            buckets: { ...state.buckets, [id]: bucket },
            tasks: { ...state.tasks, ...Object.fromEntries(affectedTasks.map((t) => [t.id, t])) },
          })),
      },
    })
  },
  reorderBuckets: (boardId, orderedIds) => {
    const updates: Record<string, Bucket> = {}
    orderedIds.forEach((id, index) => {
      const bucket = get().buckets[id]
      if (bucket && bucket.boardId === boardId && bucket.order !== index) updates[id] = { ...bucket, order: index }
    })
    if (Object.keys(updates).length === 0) return
    set((state) => ({ buckets: { ...state.buckets, ...updates } }))
    Object.values(updates).forEach((b) => repo.putBucket(b))
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
    set((state) => ({ tasks: { ...state.tasks, [id]: task } }))
    repo.putTask(task)
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
    // Shift every other active task in this bucket down by one to make room at the top —
    // completed tasks keep their own separate order sequence, same convention as moveTask.
    const shifted: Record<string, TaskCard> = {}
    Object.values(get().tasks)
      .filter((t) => t.bucketId === bucketId && t.status !== 'completed')
      .forEach((t) => {
        shifted[t.id] = { ...t, order: t.order + 1 }
      })
    set((state) => ({ tasks: { ...state.tasks, ...shifted, [id]: task } }))
    repo.putTask(task)
    Object.values(shifted).forEach((t) => repo.putTask(t))
    logActivity(id, task.name, 'create', task.status)
    return id
  },
  updateTask: (id, patch) => {
    set((state) => {
      const task = state.tasks[id]
      if (!task) return state
      return { tasks: { ...state.tasks, [id]: { ...task, ...patch } } }
    })
    if ('name' in patch || 'description' in patch) {
      debouncedPutTask(id, () => get().tasks[id])
    } else {
      const updated = get().tasks[id]
      if (updated) {
        repo.putTask(updated)
        logActivity(id, updated.name, 'status' in patch ? 'status-change' : 'update', updated.status)
      }
    }
  },
  deleteTask: (id) => {
    const task = get().tasks[id]
    if (!task) return
    finalizePendingDeletion()
    set((state) => {
      const tasks = { ...state.tasks }
      delete tasks[id]
      return { tasks }
    })
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
        restore: () => set((state) => ({ tasks: { ...state.tasks, [id]: task } })),
      },
    })
  },
  deleteTasksWithUndo: (ids) => {
    const tasksToDelete = ids.map((id) => get().tasks[id]).filter((t): t is TaskCard => !!t)
    if (tasksToDelete.length === 0) return
    finalizePendingDeletion()
    set((state) => {
      const tasks = { ...state.tasks }
      for (const t of tasksToDelete) delete tasks[t.id]
      return { tasks }
    })
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
        restore: () =>
          set((state) => ({
            tasks: { ...state.tasks, ...Object.fromEntries(tasksToDelete.map((t) => [t.id, t])) },
          })),
      },
    })
  },
  moveTask: (taskId, toBucketId, toIndex) => {
    const state = get()
    const task = state.tasks[taskId]
    if (!task) return
    const fromBucketId = task.bucketId
    const isCompleted = task.status === 'completed'

    // Active and completed tasks keep separate order sequences within a bucket, since the
    // completed section is a visually distinct sub-list (collapsed by default).
    const targetTasks = Object.values(state.tasks)
      .filter((t) => t.bucketId === toBucketId && t.id !== taskId && (t.status === 'completed') === isCompleted)
      .sort((a, b) => a.order - b.order)
    targetTasks.splice(toIndex, 0, task)

    const updates: Record<string, TaskCard> = {}
    targetTasks.forEach((t, index) => {
      updates[t.id] = { ...t, bucketId: toBucketId, order: index }
    })

    set((s) => ({ tasks: { ...s.tasks, ...updates } }))
    Object.values(updates).forEach((t) => repo.putTask(t))

    if (fromBucketId !== toBucketId) {
      const remaining = Object.values(get().tasks)
        .filter((t) => t.bucketId === fromBucketId && (t.status === 'completed') === isCompleted)
        .sort((a, b) => a.order - b.order)
      const resequenced: Record<string, TaskCard> = {}
      remaining.forEach((t, index) => {
        if (t.order !== index) resequenced[t.id] = { ...t, order: index }
      })
      if (Object.keys(resequenced).length > 0) {
        set((s) => ({ tasks: { ...s.tasks, ...resequenced } }))
        Object.values(resequenced).forEach((t) => repo.putTask(t))
      }
      logActivity(taskId, task.name, 'move', task.status)
    }
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
    const updated: TaskCard = { ...task, boardId: newBoardId, bucketId: newBucketId, categoryId: null, order }
    set((state) => ({ tasks: { ...state.tasks, [taskId]: updated } }))
    repo.putTask(updated)
    logActivity(taskId, task.name, 'move', updated.status)
  },

  startTimer: (taskId) => {
    const task = get().tasks[taskId]
    if (!task || task.timer.isRunning) return
    const updated: TaskCard = {
      ...task,
      status: task.status === 'not-started' ? 'in-progress' : task.status,
      timer: { ...task.timer, isRunning: true, startedAt: Date.now() },
    }
    set((state) => ({ tasks: { ...state.tasks, [taskId]: updated } }))
    repo.putTask(updated)
    logActivity(taskId, task.name, 'timer-start', updated.status)
  },
  pauseTimer: (taskId) => {
    const task = get().tasks[taskId]
    if (!task || !task.timer.isRunning || task.timer.startedAt == null) return
    const segmentStart = task.timer.startedAt
    const elapsedSeconds = task.timer.elapsedSeconds + (Date.now() - segmentStart) / 1000
    const updated: TaskCard = { ...task, timer: { isRunning: false, elapsedSeconds, startedAt: null } }
    set((state) => ({ tasks: { ...state.tasks, [taskId]: updated } }))
    repo.putTask(updated)
    logActivity(taskId, task.name, 'timer-pause', updated.status, segmentStart)
  },
  pauseAllTimers: (boardId) => {
    Object.values(get().tasks)
      .filter((t) => t.timer.isRunning && (boardId == null || t.boardId === boardId))
      .forEach((t) => get().pauseTimer(t.id))
  },
  resetTimer: (taskId) => {
    const task = get().tasks[taskId]
    if (!task) return
    const updated: TaskCard = { ...task, timer: { isRunning: false, elapsedSeconds: 0, startedAt: null } }
    set((state) => ({ tasks: { ...state.tasks, [taskId]: updated } }))
    repo.putTask(updated)
    // Undo only the current run's logged time (since the last reset, or since creation) — purge
    // before logging the new reset entry so it can't affect its own boundary calculation.
    purgeCurrentRunLog(taskId, task.createdAt).then(() => {
      logActivity(taskId, task.name, 'timer-reset', updated.status)
    })
  },
  setElapsedTime: (taskId, newElapsedSeconds) => {
    const task = get().tasks[taskId]
    if (!task) return

    // If running, close out the real segment first — logged exactly as a normal pause would be —
    // so the delta computed below is only the manual correction on top of genuinely tracked time.
    let baseElapsed = task.timer.elapsedSeconds
    if (task.timer.isRunning && task.timer.startedAt != null) {
      const segmentStart = task.timer.startedAt
      baseElapsed += (Date.now() - segmentStart) / 1000
      logActivity(taskId, task.name, 'timer-pause', task.status, segmentStart)
    }

    const delta = newElapsedSeconds - baseElapsed
    const updated: TaskCard = {
      ...task,
      timer: { isRunning: false, elapsedSeconds: newElapsedSeconds, startedAt: null },
    }
    set((state) => ({ tasks: { ...state.tasks, [taskId]: updated } }))
    repo.putTask(updated)
    if (delta !== 0) {
      logActivity(taskId, task.name, 'manual-adjustment', updated.status, undefined, delta)
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
    const updated: TaskCard = { ...task, status: 'completed', completedAt: Date.now(), timer }
    set((state) => ({ tasks: { ...state.tasks, [taskId]: updated } }))
    repo.putTask(updated)
    logActivity(taskId, task.name, 'status-change', updated.status, segmentStart)

    if (updated.recurrence && updated.dueDate) {
      const nextId = crypto.randomUUID()
      const nextTask: TaskCard = {
        ...updated,
        id: nextId,
        status: 'not-started',
        completedAt: null,
        dueDate: addToDateString(updated.dueDate, updated.recurrence.interval, updated.recurrence.unit),
        timer: { isRunning: false, elapsedSeconds: 0, startedAt: null },
        createdAt: Date.now(),
        subtasks: updated.subtasks.map((s) => ({ ...s, id: crypto.randomUUID(), done: false })),
      }
      set((state) => ({ tasks: { ...state.tasks, [nextId]: nextTask } }))
      repo.putTask(nextTask)
      logActivity(nextId, nextTask.name, 'create', nextTask.status)
    }
  },
  uncompleteTask: (taskId) => {
    const task = get().tasks[taskId]
    if (!task) return
    const updated: TaskCard = { ...task, status: 'not-started', completedAt: null }
    set((state) => ({ tasks: { ...state.tasks, [taskId]: updated } }))
    repo.putTask(updated)
    logActivity(taskId, task.name, 'status-change', updated.status)
  },

  addCategory: (boardId, name, color) => {
    const id = crypto.randomUUID()
    const category: Category = { id, boardId, name, color }
    set((state) => ({ categories: { ...state.categories, [id]: category } }))
    repo.putCategory(category)
    return id
  },
  updateCategory: (id, patch) => {
    set((state) => {
      const category = state.categories[id]
      if (!category) return state
      return { categories: { ...state.categories, [id]: { ...category, ...patch } } }
    })
    if ('name' in patch) {
      debouncedPutCategory(id, () => get().categories[id])
    } else {
      const updated = get().categories[id]
      if (updated) repo.putCategory(updated)
    }
  },
  deleteCategory: (id) => {
    const affectedTaskIds = Object.values(get().tasks)
      .filter((t) => t.categoryId === id)
      .map((t) => t.id)

    set((state) => {
      const categories = { ...state.categories }
      delete categories[id]
      const tasks = { ...state.tasks }
      for (const taskId of affectedTaskIds) {
        tasks[taskId] = { ...tasks[taskId], categoryId: null }
      }
      return { categories, tasks }
    })

    repo.deleteCategory(id)
    for (const taskId of affectedTaskIds) {
      const task = get().tasks[taskId]
      if (task) repo.putTask(task)
    }
  },

  exportData: async (boardIds) => {
    let data = await buildExportFile()
    if (boardIds) data = filterExportToBoards(data, boardIds)
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
    await repo.clearAllData()
    // Always restores the default example board, regardless of the seeded-before flag, so this
    // destructive action never leaves the app on a blank screen.
    const seeded = await seedExampleBoard()
    set({ ...seeded, pendingDeletion: null })
  },
  restoreFromSnapshot: async (data) => {
    const pending = get().pendingDeletion
    if (pending) clearTimeout(pending.timeoutId)
    await replaceAllDataWithSnapshot(data)
    set({ pendingDeletion: null })
    await get().loadFromDB()
  },
  }
})
