import { doc, mutate } from './collabDoc'
import { snapshotSlice } from './bridge'
import * as repo from '../db/repository'
import { reKeyBoardSubtree, downloadExportFile, type ExportFile } from '../db/exportImport'
import type { Checkpoint } from '../types'

/**
 * Version history via lightweight application-level checkpoints. We deliberately do NOT use native
 * Yjs snapshots: those need `gc: false`, which would stop deleted content — including attachment
 * blobs — from ever being reclaimed. Instead a checkpoint captures the four entity slices
 * (boards/buckets/tasks/categories) as plain JSON, stored locally in IndexedDB. Attachments are not
 * versioned in this first cut (bytes are heavy; history is about board structure/content), and
 * history is per-device (a shared team history on the server is a future upgrade).
 *
 * Restore is non-destructive: it re-keys a checkpoint's board under fresh ids and adds it as a NEW
 * board, never overwriting the live one.
 */

export const MAX_CHECKPOINTS = 20
const CHECKPOINT_INTERVAL_MS = 30 * 60 * 1000

function readEntities(): Checkpoint['entities'] {
  return {
    boards: Object.values(snapshotSlice(doc, 'boards')),
    buckets: Object.values(snapshotSlice(doc, 'buckets')),
    tasks: Object.values(snapshotSlice(doc, 'tasks')),
    categories: Object.values(snapshotSlice(doc, 'categories')),
  }
}

/** Order-independent fingerprint, so a checkpoint is only written when the content actually changed. */
function fingerprint(e: Checkpoint['entities']): string {
  const byId = <T extends { id: string }>(arr: T[]) => [...arr].sort((a, b) => a.id.localeCompare(b.id))
  return JSON.stringify({ boards: byId(e.boards), buckets: byId(e.buckets), tasks: byId(e.tasks), categories: byId(e.categories) })
}

export async function captureCheckpoint(): Promise<void> {
  const entities = readEntities()
  if (entities.boards.length === 0) return // nothing to snapshot yet

  const existing = await repo.getAllCheckpoints()
  const latest = existing.reduce<Checkpoint | null>((a, c) => (!a || c.createdAt > a.createdAt ? c : a), null)
  if (latest && fingerprint(latest.entities) === fingerprint(entities)) return // unchanged since last

  await repo.putCheckpoint({ id: crypto.randomUUID(), createdAt: Date.now(), entities })

  // Prune to the newest MAX_CHECKPOINTS.
  const all = (await repo.getAllCheckpoints()).sort((a, b) => b.createdAt - a.createdAt)
  await Promise.all(all.slice(MAX_CHECKPOINTS).map((c) => repo.deleteCheckpoint(c.id)))
}

let schedulerStarted = false
/** Capture once shortly after load, then on an interval. Idempotent. */
export function startCheckpointScheduler(): void {
  if (schedulerStarted) return
  schedulerStarted = true
  setTimeout(() => void captureCheckpoint(), 10_000)
  setInterval(() => void captureCheckpoint(), CHECKPOINT_INTERVAL_MS)
}

/** Re-key one board from a checkpoint under fresh ids and add it to the live doc as a new board. */
export function restoreCheckpointBoardAsNewBoard(checkpoint: Checkpoint, boardId: string): void {
  const { boards, buckets, tasks, categories } = checkpoint.entities
  const board = boards.find((b) => b.id === boardId)
  if (!board) return
  const suffix = ` (restored ${new Date(checkpoint.createdAt).toLocaleDateString()})`
  const rk = reKeyBoardSubtree(
    board,
    buckets.filter((b) => b.boardId === boardId),
    tasks.filter((t) => t.boardId === boardId),
    categories.filter((c) => c.boardId === boardId),
    suffix,
  )
  mutate((ops) => {
    ops.put('boards', rk.board)
    rk.buckets.forEach((b) => ops.put('buckets', b))
    rk.categories.forEach((c) => ops.put('categories', c))
    rk.tasks.forEach((t) => ops.put('tasks', t))
  })
}

/** Download a whole checkpoint as a standard export JSON (attachments not included in checkpoints). */
export function downloadCheckpoint(checkpoint: Checkpoint): void {
  const file: ExportFile = {
    version: 1,
    exportedAt: new Date(checkpoint.createdAt).toISOString(),
    ...checkpoint.entities,
    attachments: [],
  }
  downloadExportFile(file)
}
