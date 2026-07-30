import { getDB } from './db'

const FOLDER_ID_KEY = 'driveFolderId'
const FILE_ID_KEY = 'driveFileId'
const LAST_SYNCED_AT_KEY = 'driveLastSyncedAt'
const WAS_CONNECTED_KEY = 'driveWasConnected'

/** `folderId` is only needed to create a brand-new file, so it may be absent; `fileId` is the defining key. */
export async function getDriveIds(): Promise<{ folderId: string | null; fileId: string } | undefined> {
  const db = await getDB()
  const fileId = (await db.get('appSettings', FILE_ID_KEY)) as string | undefined
  if (!fileId) return undefined
  const folderId = (await db.get('appSettings', FOLDER_ID_KEY)) as string | undefined
  return { folderId: folderId ?? null, fileId }
}

export async function saveDriveIds(folderId: string | null, fileId: string): Promise<void> {
  const db = await getDB()
  if (folderId) {
    await db.put('appSettings', folderId, FOLDER_ID_KEY)
  }
  await db.put('appSettings', fileId, FILE_ID_KEY)
}

export async function clearDriveIds(): Promise<void> {
  const db = await getDB()
  await db.delete('appSettings', FOLDER_ID_KEY)
  await db.delete('appSettings', FILE_ID_KEY)
  await db.delete('appSettings', LAST_SYNCED_AT_KEY)
  await db.delete('appSettings', WAS_CONNECTED_KEY)
}

/** Stores Drive's own server-assigned `modifiedTime` for the sync file (not this device's clock), as of our last successful push or pull. */
export async function getDriveLastSyncedAt(): Promise<string | undefined> {
  const db = await getDB()
  return (await db.get('appSettings', LAST_SYNCED_AT_KEY)) as string | undefined
}

export async function setDriveLastSyncedAt(modifiedTime: string): Promise<void> {
  const db = await getDB()
  await db.put('appSettings', modifiedTime, LAST_SYNCED_AT_KEY)
}

export async function getDriveWasConnected(): Promise<boolean> {
  const db = await getDB()
  return (await db.get('appSettings', WAS_CONNECTED_KEY)) === true
}

export async function setDriveWasConnected(value: boolean): Promise<void> {
  const db = await getDB()
  await db.put('appSettings', value, WAS_CONNECTED_KEY)
}
