import * as Y from 'yjs'

/**
 * Yjs data-layer spike (Phase 1 de-risking of the collaborative/self-hostable path).
 *
 * The collaborative doc holds one top-level Y.Map per entity type, each keyed by entity id, with
 * every entity stored as its OWN nested Y.Map of fields. That nesting is what buys real merge:
 * two people editing different fields of the same task (or different tasks) converge without
 * either overwriting the other — the "proper version control" the Drive newest-wins path couldn't
 * give.
 *
 * Simplification for this first increment: complex fields (`timer`, `recurrence`, `subtasks`) are
 * stored as plain JSON values inside the entity Y.Map, i.e. whole-value last-write-wins on those
 * specific fields only. Promoting them to nested Y.Map/Y.Array (so concurrent subtask edits also
 * merge) is a later refinement, not needed to prove the architecture.
 */

export const ENTITY_KEYS = ['boards', 'buckets', 'tasks', 'categories'] as const
export type EntityKey = (typeof ENTITY_KEYS)[number]

/** The top-level Y.Map for one entity type: id -> (Y.Map of that entity's fields). */
export function getEntityMap(doc: Y.Doc, key: EntityKey): Y.Map<Y.Map<unknown>> {
  return doc.getMap(key)
}

/** Build a Y.Map of an entity's fields (scalars set directly; object/array fields kept as plain JSON). */
export function entityToYMap<T extends object>(entity: T): Y.Map<unknown> {
  const map = new Y.Map<unknown>()
  for (const [k, v] of Object.entries(entity)) map.set(k, v)
  return map
}

/** Read an entity's field Y.Map back into a plain object. */
export function yMapToEntity<T>(map: Y.Map<unknown>): T {
  return map.toJSON() as T
}
