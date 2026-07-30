import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../../store/useStore'
import { TaskCardMini } from '../task/TaskCardMini'
import { RunningTimersBanner } from '../boards/RunningTimersBanner'
import { buildDailyWorkSummary, type WorkInterval } from '../../db/activityLog'
import { todayDateKey } from '../../utils/calendarRange'
import { formatDuration, isLate } from '../../utils/time'
import type { TaskCard } from '../../types'

interface TodayViewProps {
  onOpenTask: (taskId: string) => void
}

function TaskSection({ title, tasks, onOpenTask }: { title: string; tasks: TaskCard[]; onOpenTask: (id: string) => void }) {
  if (tasks.length === 0) return null
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
        {title} ({tasks.length})
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {tasks.map((t) => (
          <TaskCardMini key={t.id} task={t} onClick={() => onOpenTask(t.id)} />
        ))}
      </div>
    </section>
  )
}

export function TodayView({ onOpenTask }: TodayViewProps) {
  const tasks = useStore(useShallow((s) => Object.values(s.tasks)))
  const pauseAllTimers = useStore((s) => s.pauseAllTimers)
  const [todaySeconds, setTodaySeconds] = useState<number | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let cancelled = false
    const now = Date.now()
    const runningIntervals: WorkInterval[] = tasks
      .filter((t) => t.timer.isRunning && t.timer.startedAt != null)
      .map((t) => ({ taskId: t.id, taskName: t.name, start: t.timer.startedAt as number, end: now }))
    buildDailyWorkSummary(runningIntervals).then((summary) => {
      if (cancelled) return
      const perTask = summary.seconds.get(todayDateKey())
      setTodaySeconds(perTask ? [...perTask.values()].reduce((a, b) => a + b, 0) : 0)
    })
    return () => {
      cancelled = true
    }
  }, [tasks, tick])

  const todayKey = todayDateKey()
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
  const open = tasks.filter((t) => t.status !== 'completed')

  const running = tasks.filter((t) => t.timer.isRunning && t.status !== 'completed')
  // Flagged tasks stay visible if completed today (so checking one off doesn't make it vanish
  // mid-session), but drop off once a day has passed since completion.
  const flagged = tasks.filter(
    (t) => t.flaggedForToday && (t.status !== 'completed' || (t.completedAt != null && t.completedAt >= startOfToday)),
  )
  const dueToday = open.filter((t) => t.dueDate === todayKey)
  const overdue = open.filter((t) => isLate(t))
  const completedToday = tasks.filter((t) => t.completedAt != null && t.completedAt >= startOfToday)

  const nothingToShow =
    running.length === 0 &&
    flagged.length === 0 &&
    dueToday.length === 0 &&
    overdue.length === 0 &&
    completedToday.length === 0
  const runningBoardCount = new Set(running.map((t) => t.boardId)).size

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <RunningTimersBanner tasks={running} boardCount={runningBoardCount} onPauseAll={() => pauseAllTimers()} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Today</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-right dark:border-gray-700 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">Tracked today</div>
          <div className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">
            {todaySeconds != null ? formatDuration(todaySeconds) : '—'}
          </div>
        </div>
      </div>

      <TaskSection title="Now running" tasks={running} onOpenTask={onOpenTask} />
      <TaskSection title="Flagged" tasks={flagged} onOpenTask={onOpenTask} />
      <TaskSection title="Due today" tasks={dueToday} onOpenTask={onOpenTask} />
      <TaskSection title="Overdue" tasks={overdue} onOpenTask={onOpenTask} />
      <TaskSection title="Completed today" tasks={completedToday} onOpenTask={onOpenTask} />

      {nothingToShow && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Nothing on your plate for today — start a timer on a task, flag one for Today, or set a due date, and
          it will show up here.
        </p>
      )}
    </div>
  )
}
