import * as Y from 'yjs'
import { doc } from './collabDoc'
import type { Attachment } from '../types'

/**
 * Attachments in the collaborative Y.Doc. Unlike boards/buckets/tasks/categories (see schema.ts),
 * attachments carry a binary blob, so they live in their OWN top-level map — kept out of the generic
 * entity bridge — and store the file as a `Uint8Array` (a content type Yjs supports natively). The
 * bytes ride inside the doc, so they sync to every client and persist offline exactly like the rest
 * of the board. Both client and server docs run with gc enabled, so deleting an attachment reclaims
 * its space rather than leaving the bytes as a tombstone.
 *
 * A per-file size cap keeps this honest: every attachment replicates to every client and the server,
 * so blobs-in-doc is right for a small team's modest files, not large media.
 */

export const ATTACHMENT_KEY = 'attachments'
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

/** id -> (Y.Map of one attachment's fields, with `bytes` holding the file). */
function getAttachmentMap(): Y.Map<Y.Map<unknown>> {
  return doc.getMap(ATTACHMENT_KEY)
}

/** Read one doc attachment record back into the app's `Attachment` (bytes -> Blob). */
function toAttachment(m: Y.Map<unknown>): Attachment {
  const bytes = m.get('bytes') as Uint8Array
  const mimeType = m.get('mimeType') as string
  // Copy into a fresh ArrayBuffer so the Blob part is unambiguously typed (Yjs hands back a
  // Uint8Array over ArrayBufferLike, which TS won't accept as a BlobPart directly).
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return {
    id: m.get('id') as string,
    taskId: m.get('taskId') as string,
    fileName: m.get('fileName') as string,
    mimeType,
    size: m.get('size') as number,
    blob: new Blob([buffer], { type: mimeType }),
    createdAt: m.get('createdAt') as number,
  }
}

export async function putAttachmentToDoc(a: Attachment): Promise<void> {
  const bytes = new Uint8Array(await a.blob.arrayBuffer())
  doc.transact(() => {
    const m = new Y.Map<unknown>()
    m.set('id', a.id)
    m.set('taskId', a.taskId)
    m.set('fileName', a.fileName)
    m.set('mimeType', a.mimeType)
    m.set('size', a.size)
    m.set('bytes', bytes)
    m.set('createdAt', a.createdAt)
    getAttachmentMap().set(a.id, m)
  })
}

export function getAttachmentsForTaskInDoc(taskId: string): Attachment[] {
  const out: Attachment[] = []
  getAttachmentMap().forEach((m) => {
    if (m.get('taskId') === taskId) out.push(toAttachment(m))
  })
  return out
}

export function getAllAttachmentsInDoc(): Attachment[] {
  const out: Attachment[] = []
  getAttachmentMap().forEach((m) => out.push(toAttachment(m)))
  return out
}

export function deleteAttachmentFromDoc(id: string): void {
  getAttachmentMap().delete(id)
}

export function deleteAttachmentsForTaskInDoc(taskId: string): void {
  const map = getAttachmentMap()
  doc.transact(() => {
    const ids: string[] = []
    map.forEach((m, id) => {
      if (m.get('taskId') === taskId) ids.push(id)
    })
    ids.forEach((id) => map.delete(id))
  })
}

export function clearAttachmentsInDoc(): void {
  getAttachmentMap().clear()
}

/** Observe any attachment change (deeply). Returns an unsubscribe. */
export function observeAttachments(onChange: () => void): () => void {
  const map = getAttachmentMap()
  map.observeDeep(onChange)
  return () => map.unobserveDeep(onChange)
}
