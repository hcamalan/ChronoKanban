# ChronoKanban collab server

A small self-hostable realtime sync server for ChronoKanban. It relays Yjs updates between all
clients connected to a room over WebSocket and persists the room's document to LevelDB so it
survives restarts. This is the backend for the (in-progress) team/collaboration mode; the public
ChronoKanban app does not need it and stays fully local-first without it.

> Status: realtime core only. No authentication and no static-file serving yet — those arrive with
> the Docker/deploy packaging step. For now, run it locally for development/testing.

## Run it locally

```
cd server
npm install
npm start
```

- Listens on `ws://0.0.0.0:1234` by default. Override with `PORT` and `HOST`.
- Persists to `./data` (LevelDB). Override with `YPERSISTENCE`.
- On `npm install` you may see a warning about an install script for `classic-level` (LevelDB's
  native binding). It's benign — the package ships prebuilt binaries that load without running that
  script, so persistence works regardless.

## Point the client at it

Team mode is opt-in via an environment variable read at build/dev time by the Vite client. Create a
**`.env.local`** in the repository root (it's gitignored):

```
VITE_COLLAB_SERVER=ws://localhost:1234
```

Then, from the repository root:

```
npm run dev
```

Without `.env.local`, `npm run dev` runs the normal local-first app (no server connection).

## Verifying realtime sync

Open the app in **two different browsers** (or one normal window + one incognito) so they don't
share the same local IndexedDB — that way the server is the only thing linking them. An edit in one
should appear in the other within a moment. Stop and restart the server: the boards are still there
(LevelDB persistence). Stop the server while editing: edits keep working locally and sync up when it
comes back.
