import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { DarkModeToggle } from './DarkModeToggle'
import { ConfirmDialog } from '../boards/ConfirmDialog'
import { ImportConflictDialog } from '../boards/ImportConflictDialog'
import { FieldsPanel } from './FieldsPanel'
import { VersionHistoryModal } from './VersionHistoryModal'
import { isTeamMode, signOut } from '../../collab/collabDoc'
import { AutoSyncPanel } from './AutoSyncPanel'
import { isAutoSyncSupported, useAutoSyncStore } from '../../store/useAutoSyncStore'
import { GoogleDriveSyncPanel } from './GoogleDriveSyncPanel'
import { useGoogleDriveSyncStore } from '../../store/useGoogleDriveSyncStore'
import { BUCKET_WIDTH_OPTIONS } from '../../utils/bucketWidth'
import { requestNotificationPermission } from '../../utils/notifications'
import {
  parseImportFile,
  findBoardConflicts,
  mergeImportFile,
  type BoardConflict,
  type ConflictDecision,
} from '../../db/exportImport'
import type { DateFormat, ColorMode } from '../../types'

interface SettingsPanelProps {
  onDataDeleted: () => void
}

interface ImportFlow {
  data: Awaited<ReturnType<typeof parseImportFile>>
  conflicts: BoardConflict[]
  currentIndex: number
  decisions: Record<string, ConflictDecision>
}

const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: 'DD/MM', label: 'DD/MM (05/03)' },
  { value: 'MM/DD', label: 'MM/DD (03/05)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (05/03/2026)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (03/05/2026)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-03-05)' },
]

const COLOR_MODE_OPTIONS: { value: ColorMode; label: string }[] = [
  { value: 'default', label: 'Off' },
  { value: 'colorblind-safe', label: 'Colorblind-safe' },
]

const selectClass =
  'rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

export function SettingsPanel({ onDataDeleted }: SettingsPanelProps) {
  const [open, setOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [autoSyncOpen, setAutoSyncOpen] = useState(false)
  const [googleDriveOpen, setGoogleDriveOpen] = useState(false)
  const [importFlow, setImportFlow] = useState<ImportFlow | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const preferences = useStore((s) => s.preferences)
  const setPreference = useStore((s) => s.setPreference)
  const deleteAllData = useStore((s) => s.deleteAllData)
  const exportData = useStore((s) => s.exportData)
  const loadFromDB = useStore((s) => s.loadFromDB)
  const autoSyncStatus = useAutoSyncStore((s) => s.status)
  const googleDriveStatus = useGoogleDriveSyncStore((s) => s.status)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    let data
    try {
      data = await parseImportFile(file)
    } catch {
      window.alert('This file could not be read as a ChronoKanban export.')
      return
    }

    const existingBoards = Object.values(useStore.getState().boards)
    const conflicts = findBoardConflicts(data, existingBoards)

    if (conflicts.length === 0) {
      await mergeImportFile(data, [], {})
      await loadFromDB()
      return
    }
    setImportFlow({ data, conflicts, currentIndex: 0, decisions: {} })
  }

  async function handleConflictDecision(decision: ConflictDecision) {
    if (!importFlow) return
    const conflict = importFlow.conflicts[importFlow.currentIndex]
    const decisions = { ...importFlow.decisions, [conflict.incoming.id]: decision }
    const nextIndex = importFlow.currentIndex + 1

    if (nextIndex >= importFlow.conflicts.length) {
      await mergeImportFile(importFlow.data, importFlow.conflicts, decisions)
      await loadFromDB()
      setImportFlow(null)
    } else {
      setImportFlow({ ...importFlow, decisions, currentIndex: nextIndex })
    }
  }

  const bucketWidthIndex = BUCKET_WIDTH_OPTIONS.findIndex((o) => o.value === preferences.bucketWidth)
  const bucketWidthLabel = BUCKET_WIDTH_OPTIONS[bucketWidthIndex]?.label ?? 'Default'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="md:hidden"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span className="hidden md:inline">Settings</span>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-2 px-1 text-xs font-medium text-gray-500 dark:text-gray-400">Preferences</h3>

          <DarkModeToggle />

          <div className="mt-3 px-1">
            <label className="mb-1 flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
              Bucket width
              <span className="text-xs text-gray-500 dark:text-gray-400">{bucketWidthLabel}</span>
            </label>
            <input
              type="range"
              min={0}
              max={BUCKET_WIDTH_OPTIONS.length - 1}
              step={1}
              value={bucketWidthIndex}
              onChange={(e) => setPreference('bucketWidth', BUCKET_WIDTH_OPTIONS[Number(e.target.value)].value)}
              className="w-full"
            />
          </div>

          <label className="mt-3 flex flex-col gap-1 px-1 text-sm text-gray-700 dark:text-gray-200">
            Date format
            <select
              value={preferences.dateFormat}
              onChange={(e) => setPreference('dateFormat', e.target.value as DateFormat)}
              className={selectClass}
            >
              {DATE_FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 flex flex-col gap-1 px-1 text-sm text-gray-700 dark:text-gray-200">
            Colorblind mode
            <select
              value={preferences.colorMode}
              onChange={(e) => setPreference('colorMode', e.target.value as ColorMode)}
              className={selectClass}
            >
              {COLOR_MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 flex items-center gap-2 px-1 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={preferences.showDescriptionOnCard}
              onChange={(e) => setPreference('showDescriptionOnCard', e.target.checked)}
            />
            Show description on card
          </label>

          <label className="mt-3 flex items-center gap-2 px-1 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={preferences.notificationsEnabled}
              onChange={async (e) => {
                if (e.target.checked) {
                  const granted = await requestNotificationPermission()
                  if (!granted) {
                    window.alert('Notifications are blocked for this site — allow them in your browser settings first.')
                    return
                  }
                }
                setPreference('notificationsEnabled', e.target.checked)
              }}
            />
            Desktop notifications
          </label>

          <div className="mt-3 flex gap-1 border-t border-gray-200 pt-3 dark:border-gray-700">
            <button
              onClick={() => {
                exportData()
                setOpen(false)
              }}
              className="flex-1 rounded px-1 py-1 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Export
            </button>
            <button
              onClick={() => {
                fileInputRef.current?.click()
                setOpen(false)
              }}
              className="flex-1 rounded px-1 py-1 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Import
            </button>
          </div>

          <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
            {isAutoSyncSupported && googleDriveStatus !== 'connected' ? (
              <button
                onClick={() => {
                  setOpen(false)
                  setAutoSyncOpen(true)
                }}
                title="Automatically keeps a file in a folder on your computer in sync with your data — so opening ChronoKanban elsewhere picks up your latest boards."
                className="w-full rounded px-1 py-1 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Auto-sync folder…
              </button>
            ) : (
              <span
                title={
                  googleDriveStatus === 'connected'
                    ? 'Disconnect Google Drive sync first — only one sync provider can be active at a time.'
                    : "Needs a Chromium browser's File System Access support — not available in Firefox, Safari, or Brave (which disables it by default for privacy reasons)."
                }
                className="block w-full cursor-not-allowed rounded px-1 py-1 text-left text-sm text-gray-400 dark:text-gray-500"
              >
                Auto-sync folder…
              </span>
            )}
          </div>

          <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
            {autoSyncStatus !== 'connected' && googleDriveStatus !== 'notConfigured' ? (
              <button
                onClick={() => {
                  setOpen(false)
                  setGoogleDriveOpen(true)
                }}
                title="Automatically keeps a file in a folder in your Google Drive in sync with your data — so opening ChronoKanban on another computer picks up your latest boards. In limited beta while Google verification is pending."
                className="w-full rounded px-1 py-1 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Google Drive sync (beta)…
              </button>
            ) : (
              <span
                title={
                  autoSyncStatus === 'connected'
                    ? 'Disconnect Auto-sync folder first — only one sync provider can be active at a time.'
                    : 'Not set up yet — needs a Google Cloud OAuth Client ID configured in the app first.'
                }
                className="block w-full cursor-not-allowed rounded px-1 py-1 text-left text-sm text-gray-400 dark:text-gray-500"
              >
                Google Drive sync (beta)…
              </span>
            )}
          </div>

          <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
            <button
              onClick={() => {
                setOpen(false)
                setFieldsOpen(true)
              }}
              className="w-full rounded px-1 py-1 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Fields…
            </button>
          </div>

          <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
            <button
              onClick={() => {
                setOpen(false)
                setVersionHistoryOpen(true)
              }}
              title="Automatic on-device snapshots of your boards. Restore an earlier version as a new board without touching your current one."
              className="w-full rounded px-1 py-1 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Version history…
            </button>
          </div>

          {isTeamMode && (
            <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
              <button
                onClick={() => {
                  signOut()
                  window.location.reload()
                }}
                title="Sign out of this shared board on this device — you'll be asked for the board password again."
                className="w-full rounded px-1 py-1 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Leave board
              </button>
            </div>
          )}

          <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
            <button
              onClick={() => {
                setOpen(false)
                setConfirmingDelete(true)
              }}
              className="w-full rounded px-1 py-1 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            >
              Delete all my data
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleFileSelected}
        className="hidden"
      />

      {fieldsOpen && <FieldsPanel onClose={() => setFieldsOpen(false)} />}

      {versionHistoryOpen && (
        <VersionHistoryModal
          onClose={() => setVersionHistoryOpen(false)}
          onRestored={() => {
            setVersionHistoryOpen(false)
            onDataDeleted()
          }}
        />
      )}

      {autoSyncOpen && <AutoSyncPanel onClose={() => setAutoSyncOpen(false)} />}

      {googleDriveOpen && <GoogleDriveSyncPanel onClose={() => setGoogleDriveOpen(false)} />}

      {confirmingDelete && (
        <ConfirmDialog
          message="This permanently deletes every board, bucket, task, and category stored in this browser. This cannot be undone — if you haven't already, back up your data first with Export. Are you sure?"
          confirmLabel="Delete everything"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={async () => {
            await deleteAllData()
            setConfirmingDelete(false)
            onDataDeleted()
          }}
        />
      )}

      {importFlow && (
        <ImportConflictDialog
          boardName={importFlow.conflicts[importFlow.currentIndex].incoming.name}
          onDecision={handleConflictDecision}
        />
      )}
    </div>
  )
}
