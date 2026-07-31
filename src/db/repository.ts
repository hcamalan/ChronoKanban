import { getDB } from './db'
import type { Board, Bucket, TaskCard, Category, Attachment, ActivityLogEntry, Checkpoint } from '../types'

export async function getAllBoards(): Promise<Board[]> {
  const db = await getDB()
  return db.getAll('boards')
}
export async function putBoard(board: Board) {
  const db = await getDB()
  await db.put('boards', board)
}

export async function getAllBuckets(): Promise<Bucket[]> {
  const db = await getDB()
  return db.getAll('buckets')
}
export async function putBucket(bucket: Bucket) {
  const db = await getDB()
  await db.put('buckets', bucket)
}

export async function getAllTasks(): Promise<TaskCard[]> {
  const db = await getDB()
  return db.getAll('tasks')
}
export async function putTask(task: TaskCard) {
  const db = await getDB()
  await db.put('tasks', task)
}
export async function deleteTask(id: string) {
  const db = await getDB()
  const attachments = await db.getAllFromIndex('attachments', 'by-task', id)
  const tx = db.transaction(['tasks', 'attachments'], 'readwrite')
  await Promise.all([
    tx.objectStore('tasks').delete(id),
    ...attachments.map((a) => tx.objectStore('attachments').delete(a.id)),
  ])
  await tx.done
}

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDB()
  return db.getAll('categories')
}
export async function putCategory(category: Category) {
  const db = await getDB()
  await db.put('categories', category)
}
export async function deleteCategory(id: string) {
  const db = await getDB()
  await db.delete('categories', id)
}

export async function getAttachmentsForTask(taskId: string): Promise<Attachment[]> {
  const db = await getDB()
  return db.getAllFromIndex('attachments', 'by-task', taskId)
}
export async function getAllAttachments(): Promise<Attachment[]> {
  const db = await getDB()
  return db.getAll('attachments')
}
export async function putAttachment(attachment: Attachment) {
  const db = await getDB()
  await db.put('attachments', attachment)
}
export async function deleteAttachment(id: string) {
  const db = await getDB()
  await db.delete('attachments', id)
}

/** Deletes a bucket and everything inside it (its tasks and their attachments). */
export async function deleteBucketCascade(bucketId: string) {
  const db = await getDB()
  const tasks = await db.getAllFromIndex('tasks', 'by-bucket', bucketId)
  for (const task of tasks) {
    await deleteTask(task.id)
  }
  await db.delete('buckets', bucketId)
}

/** Deletes a board and everything inside it (buckets, tasks, attachments, categories). */
export async function deleteBoardCascade(boardId: string) {
  const db = await getDB()
  const buckets = await db.getAllFromIndex('buckets', 'by-board', boardId)
  for (const bucket of buckets) {
    await deleteBucketCascade(bucket.id)
  }
  const categories = await db.getAllFromIndex('categories', 'by-board', boardId)
  for (const category of categories) {
    await db.delete('categories', category.id)
  }
  await db.delete('boards', boardId)
}

export async function getAllActivityLog(): Promise<ActivityLogEntry[]> {
  const db = await getDB()
  return db.getAll('activityLog')
}
export async function putActivityLogEntry(entry: ActivityLogEntry) {
  const db = await getDB()
  await db.put('activityLog', entry)
}
export async function deleteActivityLogEntry(id: string) {
  const db = await getDB()
  await db.delete('activityLog', id)
}

export async function getAllCheckpoints(): Promise<Checkpoint[]> {
  const db = await getDB()
  return db.getAll('checkpoints')
}
export async function putCheckpoint(checkpoint: Checkpoint) {
  const db = await getDB()
  await db.put('checkpoints', checkpoint)
}
export async function deleteCheckpoint(id: string) {
  const db = await getDB()
  await db.delete('checkpoints', id)
}

const ALL_STORE_NAMES = ['boards', 'buckets', 'tasks', 'categories', 'attachments', 'activityLog', 'checkpoints'] as const

export async function clearAllData() {
  const db = await getDB()
  const tx = db.transaction(ALL_STORE_NAMES, 'readwrite')
  await Promise.all(ALL_STORE_NAMES.map((name) => tx.objectStore(name).clear()))
  await tx.done
}

/** Writes a full example-board seed (board/buckets/categories/tasks/activityLog) in one transaction. */
export async function seedDatabase(data: {
  boards: Board[]
  buckets: Bucket[]
  tasks: TaskCard[]
  categories: Category[]
  activityLog: ActivityLogEntry[]
}) {
  const db = await getDB()
  const tx = db.transaction(['boards', 'buckets', 'tasks', 'categories', 'activityLog'], 'readwrite')
  await Promise.all([
    ...data.boards.map((b) => tx.objectStore('boards').put(b)),
    ...data.buckets.map((b) => tx.objectStore('buckets').put(b)),
    ...data.tasks.map((t) => tx.objectStore('tasks').put(t)),
    ...data.categories.map((c) => tx.objectStore('categories').put(c)),
    ...data.activityLog.map((e) => tx.objectStore('activityLog').put(e)),
  ])
  await tx.done
}
