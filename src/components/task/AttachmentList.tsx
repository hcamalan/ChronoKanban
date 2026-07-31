import { useEffect, useState } from 'react'
import {
  getAttachmentsForTaskInDoc,
  putAttachmentToDoc,
  deleteAttachmentFromDoc,
  observeAttachments,
  MAX_ATTACHMENT_BYTES,
} from '../../collab/attachments'
import type { Attachment } from '../../types'

interface AttachmentListProps {
  taskId: string
}

export function AttachmentList({ taskId }: AttachmentListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  // Read the task's attachments from the doc and keep them live: a teammate's add/remove (or an
  // import) fires the observer, so the open task reflects it without reopening.
  useEffect(() => {
    const refresh = () => setAttachments(getAttachmentsForTaskInDoc(taskId))
    refresh()
    return observeAttachments(refresh)
  }, [taskId])

  useEffect(() => {
    const newUrls: Record<string, string> = {}
    for (const a of attachments) {
      newUrls[a.id] = URL.createObjectURL(a.blob)
    }
    setUrls(newUrls)
    return () => {
      Object.values(newUrls).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [attachments])

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(`"${file.name}" is too large. Attachments must be ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB or smaller.`)
      return
    }
    setError(null)
    const attachment: Attachment = {
      id: crypto.randomUUID(),
      taskId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      blob: file,
      createdAt: Date.now(),
    }
    await putAttachmentToDoc(attachment)
    // The observer refreshes the list from the doc.
  }

  function handleDelete(id: string) {
    deleteAttachmentFromDoc(id)
    // The observer refreshes the list from the doc.
  }

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">Attachments</h3>
      {attachments.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded border border-gray-200 px-2 py-1 text-sm dark:border-gray-700"
            >
              <a
                href={urls[a.id]}
                download={a.fileName}
                className="truncate text-blue-600 hover:underline dark:text-blue-400"
              >
                {a.fileName}
              </a>
              <button
                onClick={() => handleDelete(a.id)}
                aria-label={`Delete attachment ${a.fileName}`}
                className="ml-2 flex-shrink-0 rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        type="file"
        onChange={handleFileSelected}
        className="text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-gray-700 dark:text-gray-300 dark:file:bg-gray-100 dark:file:text-gray-900 dark:hover:file:bg-gray-300"
      />
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
