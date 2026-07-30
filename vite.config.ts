import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  // The self-hosted collab server (server/) is a sibling of the client in this repo. Don't let the
  // dev server's file watcher into it — leveldb keeps an exclusive lock on server/data/LOCK while
  // the server runs, which makes chokidar throw EBUSY. The client build doesn't depend on server/.
  server: {
    watch: { ignored: ['**/server/**'] },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ChronoKanban',
        short_name: 'ChronoKanban',
        description: 'A Kanban board with built-in time tracking, running entirely in your browser.',
        theme_color: '#111827',
        background_color: '#111827',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'logo.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
})
