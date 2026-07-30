import * as repo from './repository'
import { toDateKey } from '../utils/calendarRange'
import type {
  Board,
  Bucket,
  Category,
  TaskCard,
  ActivityLogEntry,
  Subtask,
  Recurrence,
  Urgency,
  Importance,
  TaskStatus,
  TimerState,
} from '../types'

const DAY = 24 * 60 * 60 * 1000
const MIN = 60 * 1000

const EXAMPLE_SEEDED_KEY = 'chrono-kanban-example-seeded'

/** Whether the example board has ever been seeded — used to avoid resurrecting it after a deliberate delete. */
export function hasSeededExampleBefore(): boolean {
  return localStorage.getItem(EXAMPLE_SEEDED_KEY) === 'true'
}

function markExampleSeeded(): void {
  localStorage.setItem(EXAMPLE_SEEDED_KEY, 'true')
}

type BucketKey = 'backlog' | 'todo' | 'inProgress' | 'codeReview' | 'done'
type CategoryKey = 'feature' | 'bug' | 'techDebt' | 'meeting' | 'docs' | 'devops'

interface TaskSpec {
  name: string
  bucket: BucketKey
  category: CategoryKey
  status: TaskStatus
  urgency?: Urgency
  importance?: Importance
  storyPoints?: number
  estimatedHours?: number
  /** Relative to today; 0 = due today, negative = overdue. */
  dueOffsetDays?: number
  recurrence?: Recurrence
  assignedTo?: string
  subtasks?: string[]
  description?: string
  /** Number of historical work sessions to synthesize. */
  sessions?: number
  /** For completed tasks: how many days ago the last session (and completion) happened. */
  completedDaysAgo?: number
}

const TASK_SPECS: TaskSpec[] = [
  // --- Backlog ---
  {
    name: 'Design multi-tenant data isolation',
    bucket: 'backlog',
    category: 'feature',
    status: 'not-started',
    importance: 'high',
    subtasks: [
      'Evaluate schema-per-tenant vs row-level security',
      'Prototype row-level security policies',
      'Benchmark query performance impact',
    ],
    description:
      "Design how tenant data stays isolated as we move upmarket to larger customers.\n\n- Row-level security vs schema-per-tenant\n- Migration path for existing single-tenant data\n\n**Decision needed by:** next planning cycle",
  },
  {
    name: 'Draft RFC: event-driven order pipeline',
    bucket: 'backlog',
    category: 'feature',
    status: 'not-started',
    description:
      'RFC proposing we move order processing to an event-driven pipeline instead of the current synchronous chain.\n\n**Goals:**\n- Decouple inventory, billing, and shipping\n- Reduce order API p95 latency\n\n[Draft RFC](https://github.com/example-org/example-repo/wiki/rfc-event-driven-orders)',
  },

  // --- To Do ---
  {
    name: 'Implement OAuth refresh-token rotation',
    bucket: 'todo',
    category: 'feature',
    status: 'not-started',
    urgency: 'high',
    importance: 'high',
    storyPoints: 5,
    estimatedHours: 8,
    dueOffsetDays: 2,
    subtasks: [
      'Design token rotation flow',
      'Implement refresh endpoint',
      'Add rotation to client SDK',
      'Write migration guide for existing tokens',
    ],
    description:
      "Rotate refresh tokens automatically to reduce blast radius of a leaked token.\n\n**Acceptance criteria:**\n- Old refresh token invalidated within 5 minutes of rotation\n- Rotation is transparent to the mobile client\n- Covered by integration tests\n\nSee [design doc](https://github.com/example-org/example-repo/wiki/oauth-rotation).",
  },
  {
    name: 'Fix flaky test in checkout CI job',
    bucket: 'todo',
    category: 'bug',
    status: 'not-started',
    urgency: 'high',
    storyPoints: 2,
    estimatedHours: 2,
    dueOffsetDays: 0,
    subtasks: ['Add retry-free wait condition', 'Remove hard-coded sleep'],
  },
  {
    name: 'Sprint planning',
    bucket: 'todo',
    category: 'meeting',
    status: 'not-started',
    estimatedHours: 1,
    dueOffsetDays: 3,
    recurrence: { interval: 2, unit: 'week' },
  },

  // --- In Progress ---
  {
    name: 'Investigate memory leak in worker service',
    bucket: 'inProgress',
    category: 'bug',
    status: 'in-progress',
    urgency: 'high',
    importance: 'high',
    storyPoints: 5,
    estimatedHours: 6,
    dueOffsetDays: -1,
    sessions: 4,
    subtasks: ['Reproduce leak locally with heap snapshots', 'Bisect recent worker changes', 'Patch and verify with load test'],
    description:
      "Worker process RSS grows ~40MB/hour under sustained load until OOM-killed after ~18 hours.\n\n**Suspects:**\n- Unbounded event listener registration in the job queue consumer\n- Retained closures in the retry-backoff timer\n\nHeap snapshots attached in [incident channel](https://github.com/example-org/example-repo/issues/501).",
  },
  {
    name: 'Migrate CI from Jenkins to GitHub Actions',
    bucket: 'inProgress',
    category: 'devops',
    status: 'in-progress',
    storyPoints: 8,
    estimatedHours: 16,
    sessions: 4,
    subtasks: ['Audit existing Jenkins jobs', 'Write GitHub Actions workflows', 'Migrate deploy credentials', 'Decommission Jenkins'],
  },
  {
    name: 'Refactor legacy auth middleware',
    bucket: 'inProgress',
    category: 'techDebt',
    status: 'in-progress',
    storyPoints: 5,
    estimatedHours: 8,
    sessions: 3,
    description:
      "The current auth middleware predates our move to JWT and still has a session-cookie fallback path nobody uses.\n\n**Plan:**\n- Confirm cookie fallback has zero traffic (check access logs)\n- Remove dead code path\n- Simplify middleware chain",
  },

  // --- Code Review ---
  {
    name: 'PR #482: rate limiter for public API',
    bucket: 'codeReview',
    category: 'feature',
    assignedTo: 'Marcus Chen',
    status: 'in-progress',
    storyPoints: 5,
    estimatedHours: 6,
    sessions: 3,
    description:
      "Adds a token-bucket rate limiter in front of the public API.\n\n**Changes:**\n- New `RateLimiter` middleware\n- Configurable per-API-key limits\n- 429 responses include `Retry-After`\n\n[View PR #482](https://github.com/example-org/example-repo/pull/482)",
    subtasks: ['Add tests for token bucket edge cases', 'Address review comments on config'],
  },
  {
    name: 'PR #486: fix OAuth token refresh race condition',
    bucket: 'codeReview',
    category: 'bug',
    status: 'in-progress',
    urgency: 'high',
    assignedTo: 'Marcus Chen',
    storyPoints: 3,
    sessions: 2,
  },

  // --- Done ---
  { name: 'Set up CI pipeline for staging deploys', bucket: 'done', category: 'devops', status: 'completed', storyPoints: 5, estimatedHours: 6, sessions: 3, completedDaysAgo: 28, subtasks: ['Define pipeline stages', 'Add automated smoke tests', 'Configure staging secrets'] },
  {
    name: 'Migrate database to new hosting provider',
    bucket: 'done',
    category: 'devops',
    status: 'completed',
    storyPoints: 8,
    estimatedHours: 12,
    sessions: 4,
    completedDaysAgo: 20,
    subtasks: ['Provision new database instance', 'Set up replication', 'Run cutover during maintenance window', 'Verify data integrity post-migration'],
    description:
      'Move the primary Postgres instance to the new hosting provider with zero-downtime replication.\n\n- [x] Provision instance\n- [x] Set up logical replication\n- [x] Cut over during the Sunday maintenance window\n\nRunbook: [migration-runbook.md](https://github.com/example-org/example-repo/wiki/migration-runbook)',
  },
  {
    name: 'Add CSV export for timesheets',
    bucket: 'done',
    category: 'feature',
    status: 'completed',
    storyPoints: 5,
    estimatedHours: 6,
    sessions: 3,
    completedDaysAgo: 16,
    description:
      "Let users export a day-by-task CSV of tracked time.\n\n**Why:** several users asked for a way to build monthly reports without screenshotting the dashboard.\n\n- Escapes commas/quotes correctly\n- One row per (day, task)\n- Opens cleanly in Excel and Google Sheets",
  },
  { name: 'Write design doc for notifications system', bucket: 'done', category: 'docs', status: 'completed', storyPoints: 2, estimatedHours: 3, sessions: 1, completedDaysAgo: 12 },
  { name: 'Deploy hotfix for login redirect bug', bucket: 'done', category: 'bug', status: 'completed', urgency: 'high', storyPoints: 2, estimatedHours: 1, sessions: 1, completedDaysAgo: 1 },
]

function dateKeyOffset(days: number, now: number): string {
  return toDateKey(new Date(now + days * DAY))
}

const SESSION_DURATIONS_MIN = [45, 90, 120, 30, 150, 60]
const SESSION_START_HOURS = [9, 10, 13, 14, 15, 16]
const SESSION_GAP_DAYS = [1, 3, 2, 4, 2, 3]

export function buildExampleBoardData(): {
  board: Board
  buckets: Bucket[]
  categories: Category[]
  tasks: TaskCard[]
  activityLog: ActivityLogEntry[]
} {
  const now = Date.now()
  const boardId = crypto.randomUUID()
  const board: Board = { id: boardId, name: 'Example board (Developer)', order: 0, createdAt: now - 60 * DAY }

  const bucketDefs: { key: BucketKey; name: string }[] = [
    { key: 'backlog', name: 'Backlog' },
    { key: 'todo', name: 'To Do' },
    { key: 'inProgress', name: 'In Progress' },
    { key: 'codeReview', name: 'Code Review' },
    { key: 'done', name: 'Done' },
  ]
  const bucketIds = {} as Record<BucketKey, string>
  const buckets: Bucket[] = bucketDefs.map((b, i) => {
    const id = crypto.randomUUID()
    bucketIds[b.key] = id
    return { id, boardId, name: b.name, order: i }
  })

  const categoryDefs: { key: CategoryKey; name: string; color: string }[] = [
    { key: 'feature', name: 'Feature', color: '#3b82f6' },
    { key: 'bug', name: 'Bug', color: '#ef4444' },
    { key: 'techDebt', name: 'Tech Debt', color: '#f59e0b' },
    { key: 'meeting', name: 'Meeting', color: '#6366f1' },
    { key: 'docs', name: 'Docs', color: '#14b8a6' },
    { key: 'devops', name: 'DevOps', color: '#06b6d4' },
  ]
  const categoryIds = {} as Record<CategoryKey, string>
  const categories: Category[] = categoryDefs.map((c) => {
    const id = crypto.randomUUID()
    categoryIds[c.key] = id
    return { id, boardId, name: c.name, color: c.color }
  })

  const tasks: TaskCard[] = []
  const activityLog: ActivityLogEntry[] = []
  const bucketCounters: Record<string, number> = {}

  TASK_SPECS.forEach((spec, index) => {
    const id = crypto.randomUUID()
    const bucketId = bucketIds[spec.bucket]
    const order = bucketCounters[bucketId] ?? 0
    bucketCounters[bucketId] = order + 1

    let elapsedSeconds = 0
    let completedAt: number | null = null
    let oldestSessionStart: number | null = null

    if (spec.sessions && spec.sessions > 0) {
      const willComplete = spec.status === 'completed'
      // At least 1 day ago, so no seeded session ever lands on today and "Tracked today" starts at zero.
      const baseDaysAgo = Math.max(1, willComplete ? (spec.completedDaysAgo ?? 1) : 1)
      const raw: { start: number; end: number }[] = []
      let daysAgo = baseDaysAgo
      for (let i = 0; i < spec.sessions; i++) {
        const dayBase = new Date(now - daysAgo * DAY)
        dayBase.setHours(SESSION_START_HOURS[(index + i) % SESSION_START_HOURS.length], 0, 0, 0)
        const start = dayBase.getTime()
        const durationMs = SESSION_DURATIONS_MIN[(index + i) % SESSION_DURATIONS_MIN.length] * MIN
        raw.push({ start, end: start + durationMs })
        daysAgo += SESSION_GAP_DAYS[i % SESSION_GAP_DAYS.length]
      }
      const chronological = [...raw].reverse() // oldest -> newest
      oldestSessionStart = chronological[0].start
      elapsedSeconds = chronological.reduce((sum, s) => sum + (s.end - s.start) / 1000, 0)

      chronological.forEach((s, i) => {
        const isLast = i === chronological.length - 1
        if (willComplete && isLast) {
          completedAt = s.end
          activityLog.push({
            id: crypto.randomUUID(),
            taskId: id,
            taskName: spec.name,
            actionType: 'status-change',
            timestamp: s.end,
            status: 'completed',
            segmentStart: s.start,
          })
        } else {
          activityLog.push({
            id: crypto.randomUUID(),
            taskId: id,
            taskName: spec.name,
            actionType: 'timer-pause',
            timestamp: s.end,
            status: 'in-progress',
            segmentStart: s.start,
          })
        }
      })
    }

    const subtasks: Subtask[] = (spec.subtasks ?? []).map((text, i) => ({
      id: crypto.randomUUID(),
      text,
      done: spec.status === 'completed' || (spec.status === 'in-progress' && i === 0),
    }))

    const timer: TimerState = { isRunning: false, elapsedSeconds, startedAt: null }

    const fallbackCreatedAt = now - (5 + index) * DAY
    const createdAt = oldestSessionStart != null ? Math.min(fallbackCreatedAt, oldestSessionStart - DAY) : fallbackCreatedAt

    const task: TaskCard = {
      id,
      boardId,
      bucketId,
      name: spec.name,
      categoryId: categoryIds[spec.category],
      status: spec.status,
      assignedTo: spec.assignedTo ?? '',
      dueDate: spec.dueOffsetDays != null ? dateKeyOffset(spec.dueOffsetDays, now) : null,
      urgency: spec.urgency ?? null,
      importance: spec.importance ?? null,
      description: spec.description ?? '',
      storyPoints: spec.storyPoints ?? null,
      estimatedHours: spec.estimatedHours ?? null,
      subtasks,
      recurrence: spec.recurrence ?? null,
      order,
      timer,
      createdAt,
      completedAt,
      flaggedForToday: false,
    }
    tasks.push(task)
  })

  return { board, buckets, categories, tasks, activityLog }
}

export async function seedExampleBoard(): Promise<{
  boards: Record<string, Board>
  buckets: Record<string, Bucket>
  tasks: Record<string, TaskCard>
  categories: Record<string, Category>
}> {
  const data = buildExampleBoardData()
  await repo.seedDatabase({ ...data, boards: [data.board] })
  markExampleSeeded()
  return {
    boards: { [data.board.id]: data.board },
    buckets: Object.fromEntries(data.buckets.map((b) => [b.id, b])),
    tasks: Object.fromEntries(data.tasks.map((t) => [t.id, t])),
    categories: Object.fromEntries(data.categories.map((c) => [c.id, c])),
  }
}
