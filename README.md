# ChronoKanban

A local-first Kanban board with built-in time tracking, analytics dashboards, and a calendar view — running entirely in your browser, with no account and no server.

**Live app: https://hcamalan.github.io/chronokanban/**

## Features

- **Kanban boards** with drag-and-drop buckets and task cards, across as many boards as you like.
- **Per-task time tracking** — start/pause a timer on any card, correct elapsed time, and compare against estimates.
- **Dashboards & calendar** — effectiveness metrics, a configurable bar/pie chart, a late-tasks list, and a day/week/month calendar of what you worked on and what's due. Export a CSV timesheet or PNG charts.
- **Categories, sub-tasks, due dates (with recurrence), urgency/importance, assignees, markdown descriptions, and attachments.**
- **Local-first & offline** — all data lives in your browser's IndexedDB; nothing is ever sent to a server. Works fully offline once loaded, and installs as a PWA.
- **Backup & sync** — export/import a JSON snapshot, keep a local folder auto-synced (Chromium browsers), or sync across devices through your own Google Drive (beta).
- **Keyboard shortcuts, dark mode, colorblind-safe palette, and a configurable field set.**

## Development

```
npm install
npm run dev
```

## Build

```
npm run build
```

Deploys to GitHub Pages automatically via `.github/workflows/deploy.yml` on push to `main`.

## License

[CC BY 4.0](LICENSE) — © Hüseyin Camalan.
