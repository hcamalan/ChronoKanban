import * as Y from 'yjs'
import type { Board, Bucket, TaskCard, Category } from '../types'
import { ENTITY_KEYS, getEntityMap, entityToYMap, yMapToEntity, type EntityKey } from './schema'

/**
 * Bridge between the collaborative Y.Doc (source of truth) and the app's existing normalized,
 * by-id shape that components/Zustand already read. Mutations write to the Y.Doc; the observer is
 * the ONLY thing that rebuilds app state, keeping the flow unidirectional (mutation -> Y.Doc ->
 * observer -> setState -> render). Because Yjs applies local edits synchronously, the observer
 * fires immediately, so this feels as responsive as the current direct-write store.
 */

export interface NormalizedState {
  boards: Record<string, Board>
  buckets: Record<string, Bucket>
  tasks: Record<string, TaskCard>
  categories: Record<string, Category>
}

/** Rebuild the full normalized snapshot from the doc. Cheap at this data scale (a handful of boards). */
export function snapshotNormalized(doc: Y.Doc): NormalizedState {
  const read = <T>(key: EntityKey): Record<string, T> => {
    const out: Record<string, T> = {}
    getEntityMap(doc, key).forEach((ymap, id) => {
      out[id] = yMapToEntity<T>(ymap)
    })
    return out
  }
  return {
    boards: read<Board>('boards'),
    buckets: read<Bucket>('buckets'),
    tasks: read<TaskCard>('tasks'),
    categories: read<Category>('categories'),
  }
}

/** Call `onChange` with a fresh snapshot on every doc change (local or remote). Returns an unsubscribe. */
export function observeNormalized(doc: Y.Doc, onChange: (state: NormalizedState) => void): () => void {
  const handler = () => onChange(snapshotNormalized(doc))
  for (const key of ENTITY_KEYS) getEntityMap(doc, key).observeDeep(handler)
  return () => {
    for (const key of ENTITY_KEYS) getEntityMap(doc, key).unobserveDeep(handler)
  }
}

// --- Mutation helpers: each is one transaction (atomic; fires the observer once). ---

/** Insert or fully replace an entity. */
export function putEntity(doc: Y.Doc, key: EntityKey, entity: { id: string }): void {
  doc.transact(() => {
    getEntityMap(doc, key).set(entity.id, entityToYMap(entity))
  })
}

/** Patch specific fields of an existing entity (per-field, so concurrent edits to other fields survive). */
export function updateEntityFields(doc: Y.Doc, key: EntityKey, id: string, patch: Record<string, unknown>): void {
  doc.transact(() => {
    const ymap = getEntityMap(doc, key).get(id)
    if (!ymap) return
    for (const [k, v] of Object.entries(patch)) ymap.set(k, v)
  })
}

/** Remove an entity. */
export function deleteEntity(doc: Y.Doc, key: EntityKey, id: string): void {
  doc.transact(() => {
    getEntityMap(doc, key).delete(id)
  })
}
