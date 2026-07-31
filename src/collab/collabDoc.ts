import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebsocketProvider } from 'y-websocket'
import * as repo from '../db/repository'
import { buildExampleBoardData, hasSeededExampleBefore, markExampleSeeded } from '../db/exampleBoard'
import { getEntityMap, ENTITY_KEYS } from './schema'
import { transact, observeSlice, snapshotSlice, type Ops } from './bridge'
import { putAttachmentToDoc, clearAttachmentsInDoc } from './attachments'
import type { Board, Bucket, TaskCard, Category } from '../types'

/**
 * The app's single collaborative Y.Doc. `y-indexeddb` is always the local/offline cache and, when
 * no server is configured, the sole source of truth (Phase-1 local-only behavior). When a server
 * URL is provided (VITE_COLLAB_SERVER), a `y-websocket` provider attaches to the SAME doc for
 * real-time multi-user sync — both persistences coexist and merge via Yjs. Attachments and the
 * activity log stay in their own IndexedDB stores (via repository); preferences stay in localStorage.
 *
 * Personal vs team local storage are kept in SEPARATE IndexedDB rooms so they never cross-merge:
 * the server-side room name (what identifies the shared doc on the server) is always the same, but
 * the LOCAL persistence room is namespaced per server in team mode. That way a browser that was
 * used in local-only mode won't push its personal boards up when it later connects to a team server
 * (and two different team servers reused at one origin stay isolated too). Note: attachments and the
 * activity log live in shared, per-origin IndexedDB stores (not namespaced) — benign since both are
 * keyed by random task ids that don't collide; syncing them is separate, larger work.
 */

/** Team-mode connection state, surfaced to the UI. Meaningless (and hidden) in local-only mode. */
export type CollabStatus = 'connecting' | 'syncing' | 'connected' | 'offline'

const SERVER_ROOM = 'chronokanban'
const MIGRATED_KEY = 'chrono-kanban-yjs-migrated'
const TOKEN_KEY = 'chrono-collab-token'

const SERVER_URL = (import.meta.env.VITE_COLLAB_SERVER as string | undefined)?.trim() || undefined
// A token baked in at build time (VITE_COLLAB_TOKEN) is optional. When present it auto-authenticates
// (handy for a private/dev deploy). When ABSENT, the app prompts each user for the board password at
// runtime (see BoardPasswordGate) and uses that as the token — the real login gate, since the server
// enforces it. The board password is simply the server's COLLAB_TOKEN.
const BAKED_TOKEN = (import.meta.env.VITE_COLLAB_TOKEN as string | undefined)?.trim() || undefined
/** True when connected to a shared server (team mode) vs. purely local. */
export const isTeamMode = !!SERVER_URL

// Local IndexedDB cache room. Local-only mode keeps the original 'chronokanban' room (so existing
// personal data still loads); team mode uses a room derived from the server URL, isolating the team
// doc's local cache from personal data and from any other team server.
const LOCAL_ROOM = SERVER_URL
  ? `chronokanban-team-${SERVER_URL.replace(/[^a-zA-Z0-9]+/g, '-')}`
  : 'chronokanban'

export const doc = new Y.Doc()
const persistence = new IndexeddbPersistence(LOCAL_ROOM, doc)

/** The token to authenticate with: baked-in wins, else whatever the user last entered (localStorage). */
function currentToken(): string | undefined {
  return BAKED_TOKEN || localStorage.getItem(TOKEN_KEY) || undefined
}

let wsProvider: WebsocketProvider | null = null
// Set during initCollab so a provider created LATER (after the password prompt) can still push status.
let pushStatus: (() => void) | null = null

/** Create the websocket provider with `token` and wire its status into the store. Idempotent-ish. */
function createProvider(token: string): void {
  if (wsProvider) return
  wsProvider = new WebsocketProvider(SERVER_URL!, SERVER_ROOM, doc, { params: { token } })
  if (pushStatus) {
    wsProvider.on('status', pushStatus)
    wsProvider.on('sync', pushStatus)
    pushStatus()
  }
}

// Connect immediately when we already have a token (baked, or remembered from a previous visit).
if (SERVER_URL && currentToken()) {
  createProvider(currentToken()!)
}

/** True when team mode is on but no board password is available yet — the app must prompt for it. */
export function needsPassword(): boolean {
  return isTeamMode && !currentToken()
}

/** True when a password remembered from a previous visit exists and should be re-verified on load. */
export function hasRememberedPassword(): boolean {
  return isTeamMode && !BAKED_TOKEN && !!localStorage.getItem(TOKEN_KEY)
}

/** Check a candidate board password against the server (used to give a clean wrong-password message). */
export async function validatePassword(password: string): Promise<boolean> {
  if (!SERVER_URL) return true
  const httpUrl = SERVER_URL.replace(/^ws/, 'http') // ws->http, wss->https
  try {
    const res = await fetch(`${httpUrl}/auth?token=${encodeURIComponent(password)}`)
    return res.ok
  } catch {
    return false
  }
}

/** Re-verify the remembered password (e.g. the deployer may have changed it since last visit). */
export async function validateStoredToken(): Promise<boolean> {
  const token = currentToken()
  return token ? validatePassword(token) : false
}

/** Remember the board password and connect with it. */
export function connectWithPassword(password: string): void {
  localStorage.setItem(TOKEN_KEY, password)
  createProvider(password)
}

/** Forget the board password and disconnect (leave the board / re-prompt). */
export function signOut(): void {
  localStorage.removeItem(TOKEN_KEY)
  wsProvider?.destroy()
  wsProvider = null
}

/** Collapse the provider's socket state + sync flag into the single status the UI shows. */
function deriveCollabStatus(): CollabStatus {
  if (!wsProvider) return 'offline'
  if (!wsProvider.wsconnected) return wsProvider.wsconnecting ? 'connecting' : 'offline'
  return wsProvider.synced ? 'connected' : 'syncing'
}

/** Run one or many entity writes in a single transaction (see bridge `transact`). */
export function mutate(fn: (ops: Ops) => void): void {
  transact(doc, fn)
}

/** Wipe all entity maps + attachments (used by "Delete all my data" and full-replace import). */
export function clearDocEntities(): void {
  doc.transact(() => {
    for (const key of ENTITY_KEYS) getEntityMap(doc, key).clear()
    clearAttachmentsInDoc()
  })
}

/** Write the example board into the doc, plus its demo activity-log entries into their store. */
export function seedExampleIntoDoc(): void {
  const data = buildExampleBoardData()
  mutate((ops) => {
    ops.put('boards', data.board)
    data.buckets.forEach((b) => ops.put('buckets', b))
    data.categories.forEach((c) => ops.put('categories', c))
    data.tasks.forEach((t) => ops.put('tasks', t))
  })
  data.activityLog.forEach((entry) => {
    void repo.putActivityLogEntry(entry)
  })
  markExampleSeeded()
}

/** One-time, non-destructive copy of any pre-Yjs local boards (old IndexedDB stores) into the doc. */
async function migrateFromRepo(): Promise<boolean> {
  const boards = await repo.getAllBoards()
  if (boards.length === 0) return false
  const [buckets, tasks, categories] = await Promise.all([
    repo.getAllBuckets(),
    repo.getAllTasks(),
    repo.getAllCategories(),
  ])
  mutate((ops) => {
    boards.forEach((b) => ops.put('boards', b))
    buckets.forEach((b) => ops.put('buckets', b))
    // Backfill fields added after these tasks were first stored, same as the old loadFromDB did.
    tasks.forEach((t) =>
      ops.put('tasks', { ...t, estimatedHours: t.estimatedHours ?? null, flaggedForToday: t.flaggedForToday ?? false }),
    )
    categories.forEach((c) => ops.put('categories', c))
  })
  // Attachments now live in the doc too; bring existing local files along (blob -> bytes).
  const attachments = await repo.getAllAttachments()
  await Promise.all(attachments.map((a) => putAttachmentToDoc(a)))
  return true
}

type SliceSetter = (partial: {
  boards?: Record<string, Board>
  buckets?: Record<string, Bucket>
  tasks?: Record<string, TaskCard>
  categories?: Record<string, Category>
  loaded?: boolean
  collabStatus?: CollabStatus
}) => void

/**
 * Load the doc from IndexedDB, run first-run migration/seeding on an empty doc, then wire the
 * per-slice observers into the store and flip `loaded`. Replaces the old direct-read `loadFromDB`.
 */
export async function initCollab(set: SliceSetter): Promise<void> {
  await persistence.whenSynced

  // Only seed/migrate in local mode. In team mode the server is the source of truth: skip it and
  // let the websocket provider stream the shared state in (a joiner must not seed the example
  // board and then conflict with the server's real data).
  if (!isTeamMode && getEntityMap(doc, 'boards').size === 0) {
    if (localStorage.getItem(MIGRATED_KEY) !== 'true') {
      const migrated = await migrateFromRepo()
      // Mark attempted regardless, so deleting all boards later doesn't re-resurrect old data.
      localStorage.setItem(MIGRATED_KEY, 'true')
      if (!migrated && !hasSeededExampleBefore()) seedExampleIntoDoc()
    } else if (!hasSeededExampleBefore()) {
      seedExampleIntoDoc()
    }
  }

  // Surface the team-mode connection status to the store. Store the callback at module level so a
  // provider created LATER (after the password prompt) wires into it too; attach to any provider that
  // already exists now.
  pushStatus = () => set({ collabStatus: deriveCollabStatus() })
  if (wsProvider) {
    wsProvider.on('status', pushStatus)
    wsProvider.on('sync', pushStatus)
    pushStatus()
  }

  observeSlice(doc, 'boards', (boards) => set({ boards }))
  observeSlice(doc, 'buckets', (buckets) => set({ buckets }))
  observeSlice(doc, 'tasks', (tasks) => set({ tasks }))
  observeSlice(doc, 'categories', (categories) => set({ categories }))

  set({
    boards: snapshotSlice(doc, 'boards'),
    buckets: snapshotSlice(doc, 'buckets'),
    tasks: snapshotSlice(doc, 'tasks'),
    categories: snapshotSlice(doc, 'categories'),
    loaded: true,
  })
}
