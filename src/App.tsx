import { lazy, Suspense, useEffect, useState } from 'react'
import { useStore } from './store/useStore'
import { useAutoSyncStore } from './store/useAutoSyncStore'
import { useGoogleDriveSyncStore } from './store/useGoogleDriveSyncStore'
import { useNotificationWatcher } from './hooks/useNotificationWatcher'
import { ensureInitialGracePeriod } from './store/backupStorage'
import { startCheckpointScheduler } from './collab/checkpoints'
import { isTeamMode, needsPassword, hasRememberedPassword, validateStoredToken, signOut } from './collab/collabDoc'
import { BoardPasswordGate } from './components/layout/BoardPasswordGate'
import { TopNav } from './components/layout/TopNav'
import { GoogleDriveSyncBanner } from './components/layout/GoogleDriveSyncBanner'
import { Footer } from './components/layout/Footer'
import { UndoToast } from './components/layout/UndoToast'
import { BoardListView } from './components/boards/BoardListView'
import { BoardDetailView } from './components/board/BoardDetailView'
import { TodayView } from './components/today/TodayView'

// Split out the two heaviest/least-frequently-opened views. The dashboard in particular pulls in
// recharts + html-to-image, the bulk of the bundle, which most sessions never open.
const DashboardView = lazy(() =>
  import('./components/dashboard/DashboardView').then((m) => ({ default: m.DashboardView })),
)
const HowToView = lazy(() => import('./components/layout/HowToView').then((m) => ({ default: m.HowToView })))
import { TaskDetailModal } from './components/task/TaskDetailModal'

type View =
  | { kind: 'boards' }
  | { kind: 'board'; boardId: string }
  | { kind: 'today' }
  | { kind: 'dashboard' }
  | { kind: 'howto' }

function App() {
  const [view, setView] = useState<View>({ kind: 'boards' })
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [hotkeysOpen, setHotkeysOpen] = useState(false)
  // Team-mode board-password gate. 'passed' immediately for the local-only app (and baked-token
  // deploys); 'open' prompts for the password; 'checking' re-verifies a remembered one.
  const [gate, setGate] = useState<'checking' | 'open' | 'passed'>(() =>
    !isTeamMode ? 'passed' : needsPassword() ? 'open' : hasRememberedPassword() ? 'checking' : 'passed',
  )
  const loaded = useStore((s) => s.loaded)
  const loadFromDB = useStore((s) => s.loadFromDB)
  const darkMode = useStore((s) => s.preferences.darkMode)

  useNotificationWatcher()

  // Re-verify a remembered board password on load (the deployer may have changed it). Stale → prompt.
  useEffect(() => {
    if (gate !== 'checking') return
    let cancelled = false
    validateStoredToken().then((ok) => {
      if (cancelled) return
      if (ok) {
        setGate('passed')
      } else {
        // Stale password (deployer changed it): tear down the auto-connected provider + clear it,
        // so entering the new password creates a fresh connection.
        signOut()
        setGate('open')
      }
    })
    return () => {
      cancelled = true
    }
  }, [gate])

  useEffect(() => {
    ;(async () => {
      await loadFromDB()
      ensureInitialGracePeriod()
      startCheckpointScheduler()
      await useAutoSyncStore.getState().init()
      await useGoogleDriveSyncStore.getState().init()
    })()
  }, [loadFromDB])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      // Undo last delete — only takes over from the browser's native undo when a delete is
      // actually pending, so Ctrl/Cmd+Z still works normally while editing text.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (!isTyping && useStore.getState().pendingDeletion) {
          e.preventDefault()
          useStore.getState().undoDelete()
        }
        return
      }

      if (isTyping) return

      if (e.key === '/') {
        const search = document.getElementById('task-search-input')
        if (search) {
          e.preventDefault()
          search.focus()
        }
        return
      }

      if (e.key === '?') {
        setHotkeysOpen((v) => !v)
        return
      }

      if (e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        if (view.kind === 'board') {
          const buckets = Object.values(useStore.getState().buckets)
            .filter((b) => b.boardId === view.boardId)
            .sort((a, b) => a.order - b.order)
          if (buckets.length > 0) {
            const newTaskId = useStore.getState().addTaskAtTop(view.boardId, buckets[0].id)
            setSelectedTaskId(newTaskId)
          }
        }
        return
      }

      if (e.shiftKey && e.key.toLowerCase() === 'k') {
        if (view.kind === 'board') {
          const id = useStore.getState().addBucket(view.boardId, 'New bucket')
          useStore.getState().setPendingEditBucketId(id)
        }
        return
      }

      if (e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        if (view.kind !== 'boards') {
          setView({ kind: 'boards' })
          setTimeout(() => document.getElementById('new-board-name-input')?.focus(), 50)
        } else {
          document.getElementById('new-board-name-input')?.focus()
        }
        return
      }

      if (e.key === '[' || e.key === ']') {
        if (view.kind === 'board') {
          const boards = Object.values(useStore.getState().boards).sort((a, b) => a.order - b.order)
          const idx = boards.findIndex((b) => b.id === view.boardId)
          if (idx !== -1 && boards.length > 1) {
            const direction = e.key === ']' ? 1 : -1
            const nextIdx = (idx + direction + boards.length) % boards.length
            setView({ kind: 'board', boardId: boards[nextIdx].id })
          }
        }
        return
      }

      if (view.kind === 'boards' && /^[1-9]$/.test(e.key)) {
        const boards = Object.values(useStore.getState().boards).sort((a, b) => a.order - b.order)
        const board = boards[Number(e.key) - 1]
        if (board) setView({ kind: 'board', boardId: board.id })
        return
      }

      if (!e.shiftKey && e.key.toLowerCase() === 'b') {
        setView({ kind: 'boards' })
        return
      }

      if (!e.shiftKey && e.key.toLowerCase() === 'd') {
        setView({ kind: 'dashboard' })
        return
      }

      if (!e.shiftKey && e.key.toLowerCase() === 't') {
        setView({ kind: 'today' })
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [view])

  if (gate === 'open') {
    return <BoardPasswordGate onAuthed={() => setGate('passed')} />
  }

  if (gate === 'checking' || !loaded) {
    return <div className="p-6 text-gray-500 dark:text-gray-400">Loading...</div>
  }

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-gray-50 dark:bg-gray-950">
      <TopNav
        activeTab={view.kind === 'board' ? 'boards' : view.kind}
        onNavigate={(tab) => setView({ kind: tab })}
        hotkeysOpen={hotkeysOpen}
        onHotkeysOpenChange={setHotkeysOpen}
      />
      <GoogleDriveSyncBanner />
      <div className="flex-1">
        <Suspense fallback={<div className="p-6 text-gray-500 dark:text-gray-400">Loading…</div>}>
          {view.kind === 'boards' && (
            <BoardListView onOpenBoard={(boardId) => setView({ kind: 'board', boardId })} />
          )}
          {view.kind === 'board' && (
            <BoardDetailView
              boardId={view.boardId}
              onBack={() => setView({ kind: 'boards' })}
              onOpenTask={(taskId) => setSelectedTaskId(taskId)}
            />
          )}
          {view.kind === 'today' && <TodayView onOpenTask={(taskId) => setSelectedTaskId(taskId)} />}
          {view.kind === 'dashboard' && (
            <DashboardView onOpenTask={(taskId) => setSelectedTaskId(taskId)} />
          )}
          {view.kind === 'howto' && <HowToView />}
        </Suspense>
      </div>
      <Footer />
      {selectedTaskId && (
        <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}
      <UndoToast />
    </div>
  )
}

export default App
