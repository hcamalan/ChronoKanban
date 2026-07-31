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

## Quick deploy: Railway + Netlify (easiest)

The simplest way to get a board online for a small team — no VPS, domain, or TLS setup, because both
platforms hand you an HTTPS/WSS URL automatically. You host two things: this **server** on Railway,
and the **client** (the web app) on Netlify.

**1. Deploy the server on [Railway](https://railway.app):**
- New Project → Deploy from GitHub repo → pick this repo.
- In the service **Settings**, set **Root Directory** to `server` (so it builds `server/Dockerfile`).
  If the server lives on a non-default branch, set that branch here too.
- In **Variables**, add `COLLAB_TOKEN` = a password of your choice — **this value is the board
  password** your team will type in. (Optionally add `PORT` and expose it when generating the domain.)
- **Settings → Networking → Generate Domain.** You'll get e.g. `https://your-app.up.railway.app`.
- Sanity check: opening that URL in a browser shows the plain text `ChronoKanban collab server`.

**2. Build the client pointed at it.** From the repo root, create `.env.production.local` with:

```
VITE_COLLAB_SERVER=wss://your-app.up.railway.app
```

Note `wss://` (not `https://`), and leave `VITE_COLLAB_TOKEN` unset so the app **prompts** each user
for the board password instead of baking it in. Then run `npm run build`.

**3. Host the client on [Netlify](https://www.netlify.com):** drag the resulting `dist/` folder onto
[Netlify Drop](https://app.netlify.com/drop) (or deploy it to a Netlify site) to get a public HTTPS
link.

**4. Share** the Netlify link and the board password with your team. They open the link, enter the
password, and they're on your board. To change the password later, update `COLLAB_TOKEN` in Railway —
everyone is re-prompted for the new one on their next visit (no rebuild needed).

> Note: the client is a PWA, so after you redeploy a new build, an already-open browser may serve the
> old cached version until its service worker updates (a reload or two, or test in a fresh incognito
> window).

## Deploying for real on your own box (VPS + Docker + Caddy)

The Railway path above is easiest. If you'd rather run it on your own server (a rented VPS), you need
three things: a server with a **public IP**, a **domain name** pointed at it, and **TLS**, because
browsers refuse a plain `ws://` connection from a page loaded over `https://` (which is how the client
is normally served) — it has to be `wss://`. This step packages the server with
[Caddy](https://caddyserver.com/) as a reverse proxy, which gets you
`wss://` for free: point a domain at your server and Caddy automatically obtains and renews a TLS
certificate, no manual certbot/cron setup.

### 1. Get a domain

Any of these work — all you need is one DNS **A record** pointing a (sub)domain at your VPS's IP:

- **Buy a cheap one** (~$10–15/yr): [Namecheap](https://namecheap.com), [Porkbun](https://porkbun.com),
  or the [Cloudflare registrar](https://www.cloudflare.com/products/registrar/) (sold at cost).
- **Free option:** [DuckDNS](https://www.duckdns.org) gives you `yourname.duckdns.org` pointed at
  your server's IP at no cost — fine for this use case.

### 2. Rent a VPS

Any small Ubuntu VPS works the same way — DigitalOcean, Hetzner, EC2, Linode, etc. If you have no
preference, DigitalOcean or Hetzner's cheapest droplet (~$4-6/mo) is the least fiddly to set up; use
EC2 instead if you'd rather stay inside AWS. Once it's running, point your domain's A record at its
public IP.

### 3. Install Docker on the VPS

Follow Docker's official install steps for your distro (e.g.
[docs.docker.com/engine/install/ubuntu](https://docs.docker.com/engine/install/ubuntu/)) — this
installs both the Docker engine and the `docker compose` plugin used below.

### 4. Copy this `server/` folder to the VPS and configure it

```
cp .env.example .env
```

Edit `.env` and fill in your real `DOMAIN` and a `COLLAB_TOKEN` (a password of your choosing —
required, since this server is now reachable by anyone who finds the address).

### 5. Start it

```
docker compose up -d --build
```

This builds the server image and starts two containers: the collab server (not exposed directly —
only reachable through Caddy) and Caddy (published on ports 80/443, obtains the TLS cert, and proxies
to the server). Board data (LevelDB) and the TLS certificate both live in Docker volumes, so they
survive `docker compose restart`/updates.

### 6. Open the firewall

Only ports **80** and **443** need to be open on the VPS (80 is needed for the ACME/Let's Encrypt
challenge and redirects to 443). Port 1234 is never exposed to the host, so `ws://` (unencrypted)
access from outside is impossible — `wss://` via Caddy is the only way in.

### 7. Verify

- Visit `https://yourdomain.com` in a browser — you should see the server's plain-text health
  response. If that loads over HTTPS with a valid padlock, TLS is working.
- Point a client build at it: `VITE_COLLAB_SERVER=wss://yourdomain.com` and `VITE_COLLAB_TOKEN`
  matching what you put in `.env`, then build/host that client somewhere reachable (this repo doesn't
  do that hosting step for you — see the note above about `VITE_COLLAB_SERVER`/`VITE_COLLAB_TOKEN`
  being build-time values).
- Test sync from two different networks/devices, not just two browser tabs on the same machine.
