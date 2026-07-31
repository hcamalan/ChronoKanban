import { useState } from 'react'
import { validatePassword, connectWithPassword } from '../../collab/collabDoc'

interface BoardPasswordGateProps {
  onAuthed: () => void
}

/** Shown in team mode before the board loads: asks for the shared board password (the server's token). */
export function BoardPasswordGate({ onAuthed }: BoardPasswordGateProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || submitting) return
    setSubmitting(true)
    setError(null)
    const ok = await validatePassword(password)
    if (ok) {
      connectWithPassword(password)
      onAuthed()
    } else {
      setError('Incorrect board password.')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="mb-4 flex items-center gap-2">
          <img src="./logo.svg" alt="" className="h-7 w-7" />
          <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">ChronoKanban Teams</span>
        </div>
        <label htmlFor="board-password" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
          Board password
        </label>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          This is a shared board. Enter the password to join.
        </p>
        <input
          id="board-password"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !password}
          className="mt-4 w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          {submitting ? 'Checking…' : 'Join board'}
        </button>
      </form>
    </div>
  )
}
