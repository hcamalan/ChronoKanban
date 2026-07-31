import { useEffect, useRef, useState } from 'react'

export function DonatePanel() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded px-3 py-1.5 text-sm text-pink-700 hover:bg-pink-50 dark:text-pink-300 dark:hover:bg-pink-950"
      >
        ♥ Donate
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Support ChronoKanban Teams</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Developing and maintaining chronokanban is costly, whether it is the time investment, AI credits 
            or the specialty coffee consumed to fuel the development - if you've found some value in it, 
            a small contribution would be sincerely appreciated :)
          </p>
          <a
            href="https://paypal.me/HuseyinCamalan"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block rounded bg-pink-600 px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-pink-700"
          >
            Donate via PayPal
          </a>
        </div>
      )}
    </div>
  )
}
