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

### Optional: shared-secret auth

By default the server accepts any connection — fine for a quick localhost test, not fine for
anything reachable by other people. Set `COLLAB_TOKEN` to require every client to present it:

```
COLLAB_TOKEN=some-shared-secret npm start
```

When set, a connection without the matching `?token=` query param is rejected before it can read or
write anything. The token travels as a plaintext query string, so it only provides real protection
over `ws://localhost`, a trusted LAN, or (better) behind TLS (`wss://` via a reverse proxy) — TLS
setup isn't part of this step yet.

## Point the client at it

Team mode is opt-in via environment variables read at build/dev time by the Vite client. Create a
**`.env.local`** in the repository root (it's gitignored):

```
VITE_COLLAB_SERVER=ws://localhost:1234
VITE_COLLAB_TOKEN=some-shared-secret
```

`VITE_COLLAB_TOKEN` is only needed if the server was started with `COLLAB_TOKEN` set, and must match
it exactly. Then, from the repository root:

```
npm run dev
```

Without `.env.local`, `npm run dev` runs the normal local-first app (no server connection). Note
these are **build-time** values: everyone who uses a given deployment shares whatever server/token
were baked in when it was built — there's no in-app screen to enter them per-user.

## Verifying realtime sync

Open the app in **two different browsers** (or one normal window + one incognito) so they don't
share the same local IndexedDB — that way the server is the only thing linking them. An edit in one
should appear in the other within a moment. Stop and restart the server: the boards are still there
(LevelDB persistence). Stop the server while editing: edits keep working locally and sync up when it
comes back.
