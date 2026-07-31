import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Board, Bucket, TaskCard, Category, Attachment, ActivityLogEntry, Checkpoint } from '../types'

export interface ChronoKanbanDB extends DBSchema {
  boards: { key: string; value: Board }
  buckets: { key: string; value: Bucket; indexes: { 'by-board': string } }
  tasks: {
    key: string
    value: TaskCard
    indexes: { 'by-board': string; 'by-bucket': string }
  }
  categories: { key: string; value: Category; indexes: { 'by-board': string } }
  attachments: { key: string; value: Attachment; indexes: { 'by-task': string } }
  activityLog: { key: string; value: ActivityLogEntry }
  checkpoints: { key: string; value: Checkpoint }
  appSettings: { key: string; value: unknown }
}

const DB_NAME = 'chrono-kanban-db'
const DB_VERSION = 4

let dbPromise: Promise<IDBPDatabase<ChronoKanbanDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ChronoKanbanDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('boards', { keyPath: 'id' })

          const buckets = db.createObjectStore('buckets', { keyPath: 'id' })
          buckets.createIndex('by-board', 'boardId')

          const tasks = db.createObjectStore('tasks', { keyPath: 'id' })
          tasks.createIndex('by-board', 'boardId')
          tasks.createIndex('by-bucket', 'bucketId')

          const categories = db.createObjectStore('categories', { keyPath: 'id' })
          categories.createIndex('by-board', 'boardId')

          const attachments = db.createObjectStore('attachments', { keyPath: 'id' })
          attachments.createIndex('by-task', 'taskId')
        }
        if (oldVersion < 2) {
          db.createObjectStore('activityLog', { keyPath: 'id' })
        }
        if (oldVersion < 3) {
          db.createObjectStore('appSettings')
        }
        if (oldVersion < 4) {
          db.createObjectStore('checkpoints', { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}
