import * as Y from 'yjs'
import type { Board, Bucket, TaskCard, Category } from '../types'
import { getEntityMap, entityToYMap, yMapToEntity, type EntityKey } from './schema'

/**
 * Bridge between the collaborative Y.Doc (source of truth) and the app's existing normalized,
 * by-id shape that components/Zustand already read. Mutations write to the Y.Doc; an observer is
 * the ONLY thing that rebuilds app state, keeping the flow unidirectional (mutate -> Y.Doc ->
 * observer -> setState -> render). Because Yjs applies local edits synchronously and fires
 * observers at the end of the transaction, the observer runs before the mutating action returns,
 * so this feels as responsive as the current direct-write store.
 */

/** The runtime type behind an entity key, so slice reads/observers are typed. */
type EntityFor<K extends EntityKey> = K extends 'boards'
  ? Board
  : K extends 'buckets'
    ? Bucket
    : K extends 'tasks'
      ? TaskCard
      : Category

/** Rebuild one entity slice (id -> entity) from the doc. Cheap at this scale (a few boards). */
export function snapshotSlice<K extends EntityKey>(doc: Y.Doc, key: K): Record<string, EntityFor<K>> {
  const out: Record<string, EntityFor<K>> = {}
  getEntityMap(doc, key).forEach((ymap, id) => {
    out[id] = yMapToEntity<EntityFor<K>>(ymap)
  })
  return out
}

/**
 * Observe a single entity type (deeply, so nested field edits within an entity also fire) and hand
 * the caller a fresh slice on every change. Per-type (rather than one combined observer) so a task
 * edit only rebuilds the `tasks` slice — boards/buckets/categories keep their object identity and
 * their consumers don't re-render. Returns an unsubscribe.
 */
export function observeSlice<K extends EntityKey>(
  doc: Y.Doc,
  key: K,
  onChange: (slice: Record<string, EntityFor<K>>) => void,
): () => void {
  const map = getEntityMap(doc, key)
  const handler = () => onChange(snapshotSlice(doc, key))
  map.observeDeep(handler)
  return () => map.unobserveDeep(handler)
}

/** Raw entity operations, valid only inside a `transact` callback (they do not open their own transaction). */
export interface Ops {
  put<T extends { id: string }>(key: EntityKey, entity: T): void
  update(key: EntityKey, id: string, patch: Record<string, unknown>): void
  delete(key: EntityKey, id: string): void
}

/**
 * Run one or many entity writes in a single Yjs transaction (atomic; fires each affected slice's
 * observer once). `put` inserts/replaces a whole entity; `update` patches specific fields of an
 * existing entity (per-field, so concurrent edits to its other fields survive a future merge);
 * `delete` removes it.
 */
export function transact(doc: Y.Doc, fn: (ops: Ops) => void): void {
  doc.transact(() => {
    fn({
      put(key, entity) {
        getEntityMap(doc, key).set(entity.id, entityToYMap(entity))
      },
      update(key, id, patch) {
        const ymap = getEntityMap(doc, key).get(id)
        if (!ymap) return
        for (const [k, v] of Object.entries(patch)) ymap.set(k, v)
      },
      delete(key, id) {
        getEntityMap(doc, key).delete(id)
      },
    })
  })
}
