export type Urgency = 'low' | 'medium' | 'high'
export type Importance = 'low' | 'medium' | 'high'
export type TaskStatus = 'not-started' | 'in-progress' | 'completed'

export type BucketWidth = 'narrow' | 'default' | 'wide' | 'xwide'
export type DateFormat = 'DD/MM' | 'MM/DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
export type ColorMode = 'default' | 'colorblind-safe'

export interface Preferences {
  darkMode: boolean
  bucketWidth: BucketWidth
  dateFormat: DateFormat
  colorMode: ColorMode
  showDescriptionOnCard: boolean
  notificationsEnabled: boolean
  timeTrackingEnabled: boolean
  hiddenFields: string[]
  collapsedDashboardSections: string[]
}

export interface Category {
  id: string
  boardId: string
  name: string
  color: string
}

export interface Board {
  id: string
  name: string
  order: number
  createdAt: number
}

export interface Bucket {
  id: string
  boardId: string
  name: string
  order: number
}

export interface TimerState {
  isRunning: boolean
  /** accumulated time NOT counting the current running segment */
  elapsedSeconds: number
  /** epoch ms when the current running segment began; null if paused */
  startedAt: number | null
}

export interface Subtask {
  id: string
  text: string
  done: boolean
}

export type RecurrenceUnit = 'day' | 'week' | 'month'

export interface Recurrence {
  interval: number
  unit: RecurrenceUnit
}

export interface TaskCard {
  id: string
  boardId: string
  bucketId: string
  name: string
  categoryId: string | null
  status: TaskStatus
  assignedTo: string
  dueDate: string | null
  urgency: Urgency | null
  importance: Importance | null
  description: string
  storyPoints: number | null
  /** self-estimated effort in hours; compared against tracked time on the dashboard */
  estimatedHours: number | null
  subtasks: Subtask[]
  recurrence: Recurrence | null
  /** position within its bucket */
  order: number
  timer: TimerState
  createdAt: number
  completedAt: number | null
  /** manually flagged for the Today view, independent of due dates or time tracking */
  flaggedForToday: boolean
}

export interface Attachment {
  id: string
  taskId: string
  fileName: string
  mimeType: string
  size: number
  blob: Blob
  createdAt: number
}

export type ActivityActionType =
  | 'create'
  | 'update'
  | 'status-change'
  | 'move'
  | 'timer-start'
  | 'timer-pause'
  | 'timer-reset'
  | 'delete'
  | 'manual-adjustment'

/** A point-in-time snapshot of the board entities (not attachments), for the version-history feature. */
export interface Checkpoint {
  id: string
  createdAt: number
  entities: {
    boards: Board[]
    buckets: Bucket[]
    tasks: TaskCard[]
    categories: Category[]
  }
}

export interface ActivityLogEntry {
  id: string
  taskId: string
  /** denormalized so history survives the task itself being deleted */
  taskName: string
  actionType: ActivityActionType
  timestamp: number
  /** the task's status at the moment of this event; used to reconstruct end-of-day status */
  status?: TaskStatus
  /** epoch ms a work segment began; set only on entries that CLOSE a segment (pause / complete-while-running) */
  segmentStart?: number
  /** signed seconds delta from a manual "Time elapsed" edit; credited to this entry's own (today's) date */
  adjustmentSeconds?: number
}
