import { getDB } from './db'
import { bulkPutAll, clearAllData, deleteTask } from './repository'
import { doc, mutate, clearDocEntities } from '../collab/collabDoc'
import { snapshotSlice } from '../collab/bridge'
import type { Board, Bucket, TaskCard, Category, Attachment } from '../types'

// Entities (boards/buckets/tasks/categories) live in the Y.Doc; attachment blobs stay in their own
// IndexedDB store. So export reads entities from the doc, and import/replace writes them to the doc,
// while attachments continue to go through the repository. `bulkPutAll` is used attachments-only.
const NO_ENTITIES = { boards: [], buckets: [], tasks: [], categories: [] }

export interface ExportFile {
  version: 1
  exportedAt: string
  boards: Board[]
  buckets: Bucket[]
  tasks: TaskCard[]
  categories: Category[]
  attachments: {
    id: string
    taskId: string
    fileName: string
    mimeType: string
    size: number
    dataBase64: string
  }[]
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function base64ToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

export async function buildExportFile(): Promise<ExportFile> {
  const db = await getDB()
  const allAttachments = await db.getAll('attachments')
  const boards = Object.values(snapshotSlice(doc, 'boards'))
  const buckets = Object.values(snapshotSlice(doc, 'buckets'))
  const tasks = Object.values(snapshotSlice(doc, 'tasks'))
  const categories = Object.values(snapshotSlice(doc, 'categories'))
  const attachments = await Promise.all(
    allAttachments.map(async (a) => ({
      id: a.id,
      taskId: a.taskId,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      dataBase64: await blobToBase64(a.blob),
    })),
  )
  return { version: 1, exportedAt: new Date().toISOString(), boards, buckets, tasks, categories, attachments }
}

export function downloadExportFile(data: ExportFile) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `chronokanban-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function isValidExportFile(data: unknown): data is ExportFile {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return (
    d.version === 1 &&
    Array.isArray(d.boards) &&
    Array.isArray(d.buckets) &&
    Array.isArray(d.tasks) &&
    Array.isArray(d.categories) &&
    Array.isArray(d.attachments)
  )
}

export async function parseImportFile(file: File): Promise<ExportFile> {
  const text = await file.text()
  const data: unknown = JSON.parse(text)
  if (!isValidExportFile(data)) {
    throw new Error('Invalid export file format')
  }
  return data
}

/**
 * Wipes all local data and replaces it with the given snapshot, as-is (no conflict resolution).
 * Used for auto-sync's pull path, where the file is meant to be a deterministic mirror rather
 * than an additive merge — unlike `mergeImportFile`, which is for one-off manual imports.
 */
export async function replaceAllDataWithSnapshot(data: ExportFile): Promise<void> {
  const attachments: Attachment[] = await Promise.all(
    data.attachments.map(async (a) => ({
      id: a.id,
      taskId: a.taskId,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      blob: await base64ToBlob(a.dataBase64),
      createdAt: Date.now(),
    })),
  )
  await clearAllData() // wipes attachments + activity log (+ now-unused stale entity stores)
  clearDocEntities()
  mutate((ops) => {
    data.boards.forEach((b) => ops.put('boards', b))
    data.buckets.forEach((b) => ops.put('buckets', b))
    data.tasks.forEach((t) => ops.put('tasks', t))
    data.categories.forEach((c) => ops.put('categories', c))
  })
  await bulkPutAll({ ...NO_ENTITIES, attachments })
}

export interface BoardConflict {
  existing: Board
  incoming: Board
}

/** Boards in the import file whose name matches a board that already exists locally. */
export function findBoardConflicts(data: ExportFile, existingBoards: Board[]): BoardConflict[] {
  const existingByName = new Map(existingBoards.map((b) => [b.name, b]))
  const conflicts: BoardConflict[] = []
  for (const incoming of data.boards) {
    const existing = existingByName.get(incoming.name)
    if (existing) conflicts.push({ existing, incoming })
  }
  return conflicts
}

export type ConflictDecision = 'overwrite' | 'keep-both' | 'skip'

/**
 * Merges an imported file into the existing local data (boards are additive, never a full
 * replace). For each board in the file that name-conflicts with an existing board, `decisions`
 * (keyed by the incoming board's id) says what to do: overwrite the existing board, keep both
 * (the incoming board is renamed with a trailing "_"), or skip importing that board entirely.
 * Non-conflicting boards are always imported as-is.
 */
export async function mergeImportFile(
  data: ExportFile,
  conflicts: BoardConflict[],
  decisions: Record<string, ConflictDecision>,
): Promise<void> {
  const attachmentBlobs: Attachment[] = await Promise.all(
    data.attachments.map(async (a) => ({
      id: a.id,
      taskId: a.taskId,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      blob: await base64ToBlob(a.dataBase64),
      createdAt: Date.now(),
    })),
  )

  const conflictByIncomingId = new Map(conflicts.map((c) => [c.incoming.id, c]))
  const boardsToInsert: Board[] = []
  const bucketsToInsert: Bucket[] = []
  const tasksToInsert: TaskCard[] = []
  const categoriesToInsert: Category[] = []
  const attachmentsToInsert: Attachment[] = []
  const boardIdsToDeleteCascade: string[] = []

  for (const incomingBoard of data.boards) {
    const conflict = conflictByIncomingId.get(incomingBoard.id)
    const decision = conflict ? decisions[incomingBoard.id] : undefined

    if (decision === 'skip') continue
    if (decision === 'overwrite' && conflict) boardIdsToDeleteCascade.push(conflict.existing.id)

    const boardBuckets = data.buckets.filter((b) => b.boardId === incomingBoard.id)
    const boardCategories = data.categories.filter((c) => c.boardId === incomingBoard.id)
    const boardTasks = data.tasks.filter((t) => t.boardId === incomingBoard.id)
    const boardTaskIds = new Set(boardTasks.map((t) => t.id))
    const boardAttachments = attachmentBlobs.filter((a) => boardTaskIds.has(a.taskId))

    if (decision === 'keep-both') {
      // This is the same export data as the board it conflicts with, so its board/bucket/task/
      // category ids are identical to that existing board's — re-key everything under fresh ids
      // instead, otherwise `put` would overwrite the existing board's records in place rather
      // than creating a separate one alongside it.
      const newBoardId = crypto.randomUUID()
      const bucketIdMap = new Map(boardBuckets.map((b) => [b.id, crypto.randomUUID()]))
      const taskIdMap = new Map(boardTasks.map((t) => [t.id, crypto.randomUUID()]))
      const categoryIdMap = new Map(boardCategories.map((c) => [c.id, crypto.randomUUID()]))

      boardsToInsert.push({ ...incomingBoard, id: newBoardId, name: `${incomingBoard.name}_` })
      bucketsToInsert.push(...boardBuckets.map((b) => ({ ...b, id: bucketIdMap.get(b.id)!, boardId: newBoardId })))
      categoriesToInsert.push(
        ...boardCategories.map((c) => ({ ...c, id: categoryIdMap.get(c.id)!, boardId: newBoardId })),
      )
      tasksToInsert.push(
        ...boardTasks.map((t) => ({
          ...t,
          id: taskIdMap.get(t.id)!,
          boardId: newBoardId,
          bucketId: bucketIdMap.get(t.bucketId) ?? t.bucketId,
          categoryId: t.categoryId ? (categoryIdMap.get(t.categoryId) ?? null) : null,
        })),
      )
      attachmentsToInsert.push(
        ...boardAttachments.map((a) => ({ ...a, id: crypto.randomUUID(), taskId: taskIdMap.get(a.taskId) ?? a.taskId })),
      )
    } else {
      boardsToInsert.push(incomingBoard)
      bucketsToInsert.push(...boardBuckets)
      categoriesToInsert.push(...boardCategories)
      tasksToInsert.push(...boardTasks)
      attachmentsToInsert.push(...boardAttachments)
    }
  }

  // Overwrite = remove the existing board's whole subtree from the doc first. Snapshot the doc once
  // to find those entities, and clean the overwritten tasks' attachments via repo.deleteTask.
  const existingBuckets = snapshotSlice(doc, 'buckets')
  const existingTasks = snapshotSlice(doc, 'tasks')
  const existingCategories = snapshotSlice(doc, 'categories')
  for (const boardId of boardIdsToDeleteCascade) {
    for (const t of Object.values(existingTasks).filter((t) => t.boardId === boardId)) {
      await deleteTask(t.id)
    }
  }

  mutate((ops) => {
    for (const boardId of boardIdsToDeleteCascade) {
      ops.delete('boards', boardId)
      Object.values(existingBuckets).filter((b) => b.boardId === boardId).forEach((b) => ops.delete('buckets', b.id))
      Object.values(existingTasks).filter((t) => t.boardId === boardId).forEach((t) => ops.delete('tasks', t.id))
      Object.values(existingCategories)
        .filter((c) => c.boardId === boardId)
        .forEach((c) => ops.delete('categories', c.id))
    }
    boardsToInsert.forEach((b) => ops.put('boards', b))
    bucketsToInsert.forEach((b) => ops.put('buckets', b))
    categoriesToInsert.forEach((c) => ops.put('categories', c))
    tasksToInsert.forEach((t) => ops.put('tasks', t))
  })
  await bulkPutAll({ ...NO_ENTITIES, attachments: attachmentsToInsert })
}
