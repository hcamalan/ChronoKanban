import { useEffect, useRef, useState } from 'react'
import { SettingsPanel } from './SettingsPanel'
import { HotkeysPanel } from './HotkeysPanel'
import { DonatePanel } from './DonatePanel'
import { CollabStatus } from './CollabStatus'

interface TopNavProps {
  activeTab: 'boards' | 'today' | 'dashboard' | 'howto'
  onNavigate: (tab: 'boards' | 'today' | 'dashboard' | 'howto') => void
  hotkeysOpen: boolean
  onHotkeysOpenChange: (open: boolean) => void
}

export function TopNav({ activeTab, onNavigate, hotkeysOpen, onHotkeysOpenChange }: TopNavProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const tabClass = (tab: 'boards' | 'today' | 'dashboard') =>
    `rounded px-3 py-1.5 text-sm font-medium ${
      activeTab === tab
        ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
    }`

  const iconTabClass = (tab: 'boards' | 'today' | 'dashboard') =>
    `rounded px-2.5 py-1.5 ${
      activeTab === tab
        ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
    }`

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-gray-700 dark:bg-gray-900">
      <div className="contents md:flex md:items-center md:gap-4">
        <button
          onClick={() => onNavigate('boards')}
          className="flex items-center gap-2 rounded hover:opacity-80"
          aria-label="Go to boards"
        >
          <img src="./logo.svg" alt="" className="hidden h-7 w-7 md:block" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 md:text-lg">ChronoKanban</span>
        </button>
        <CollabStatus />
        <nav className="hidden items-center gap-1 md:flex">
          <button onClick={() => onNavigate('boards')} className={tabClass('boards')}>
            Boards
          </button>
          <button onClick={() => onNavigate('dashboard')} className={tabClass('dashboard')}>
            Dashboard
          </button>
          <button onClick={() => onNavigate('today')} className={tabClass('today')}>
            Today
          </button>
        </nav>
      </div>
      <div className="contents md:flex md:items-center md:gap-2">
        {/* Desktop action cluster */}
        <div className="hidden items-center gap-2 md:flex">
          <DonatePanel />
          <a
            href="mailto:chronokanban@pm.me?subject=ChronoKanban feedback"
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Send feedback
          </a>
          <button
            onClick={() => onNavigate('howto')}
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            How to
          </button>
          <HotkeysPanel open={hotkeysOpen} onOpenChange={onHotkeysOpenChange} />
        </div>

        {/* Mobile icon nav */}
        <div className="contents md:hidden">
          <button onClick={() => onNavigate('boards')} aria-label="Boards" className={iconTabClass('boards')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="5" height="16" rx="1" />
              <rect x="10" y="4" width="5" height="10" rx="1" />
              <rect x="17" y="4" width="5" height="13" rx="1" />
            </svg>
          </button>
          <button onClick={() => onNavigate('dashboard')} aria-label="Dashboard" className={iconTabClass('dashboard')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
              <path d="M22 12A10 10 0 0 0 12 2v10z" />
            </svg>
          </button>
          <button onClick={() => onNavigate('today')} aria-label="Today" className={iconTabClass('today')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
        </div>

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 md:hidden" />

        {/* Settings stays visible at every width */}
        <SettingsPanel onDataDeleted={() => onNavigate('boards')} />

        {/* Mobile hamburger */}
        <div ref={menuRef} className="relative md:hidden">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="rounded px-3 py-1.5 text-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            ☰
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-30 mt-1 flex w-56 flex-col rounded border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <a
                href="https://paypal.me/HuseyinCamalan"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="rounded px-3 py-2 text-left text-sm text-pink-700 hover:bg-pink-50 dark:text-pink-300 dark:hover:bg-pink-950"
              >
                ♥ Donate
              </a>
              <a
                href="mailto:chronokanban@pm.me?subject=ChronoKanban feedback"
                onClick={() => setMenuOpen(false)}
                className="rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Send feedback
              </a>
              <button
                onClick={() => {
                  onNavigate('howto')
                  setMenuOpen(false)
                }}
                className="rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                How to
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
