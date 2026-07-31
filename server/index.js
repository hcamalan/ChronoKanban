import http from 'http'
import { WebSocketServer } from 'ws'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import { LeveldbPersistence } from 'y-leveldb'

/**
 * ChronoKanban self-hostable realtime sync server.
 *
 * A self-contained port of the classic y-websocket server handler onto the SAME stable Yjs 13
 * stack the browser client uses — so there is exactly one Yjs implementation end to end (the
 * current @y/websocket-server pulls a yjs-14 prerelease under the `@y/y` name, which is
 * binary-incompatible with the yjs-13 client and y-leveldb). Clients open one WebSocket per room
 * (the room name is the URL path; the app uses "chronokanban"); Yjs sync + awareness messages are
 * relayed to every other connection in that room, and each room's document is persisted to LevelDB.
 * No auth or static-file serving yet — those come with the Docker/deploy step.
 */

const PORT = Number(process.env.PORT) || 1234
const HOST = process.env.HOST || '0.0.0.0'
const DATA_DIR = process.env.YPERSISTENCE || './data'
const PING_TIMEOUT = 30000
// Shared-secret gate: if set, every connection must present it as a `?token=` query param. Unset
// (the default) keeps today's open-access behavior for local dev.
const AUTH_TOKEN = process.env.COLLAB_TOKEN || undefined

const messageSync = 0
const messageAwareness = 1
const wsReadyStateConnecting = 0
const wsReadyStateOpen = 1

// --- Durable storage (LevelDB): load a room's persisted state on first open, then stream updates. ---
const ldb = new LeveldbPersistence(DATA_DIR)
const persistence = {
  bindState: async (docName, ydoc) => {
    const persisted = await ldb.getYDoc(docName)
    ldb.storeUpdate(docName, Y.encodeStateAsUpdate(ydoc))
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persisted))
    ydoc.on('update', (update) => {
      ldb.storeUpdate(docName, update)
    })
  },
  writeState: async () => {},
}

/** @type {Map<string, WSSharedDoc>} */
const docs = new Map()

const send = (doc, conn, message) => {
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    closeConn(doc, conn)
    return
  }
  try {
    conn.send(message, (err) => err != null && closeConn(doc, conn))
  } catch {
    closeConn(doc, conn)
  }
}

const closeConn = (doc, conn) => {
  if (doc.conns.has(conn)) {
    const controlledIds = doc.conns.get(conn)
    doc.conns.delete(conn)
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null)
    if (doc.conns.size === 0) {
      persistence.writeState(doc.name, doc).then(() => doc.destroy())
      docs.delete(doc.name)
    }
  }
  conn.close()
}

// Broadcast every doc update to all connections in the room.
const updateHandler = (update, _origin, doc) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeUpdate(encoder, update)
  const message = encoding.toUint8Array(encoder)
  doc.conns.forEach((_, conn) => send(doc, conn, message))
}

class WSSharedDoc extends Y.Doc {
  constructor(name) {
    super({ gc: true })
    this.name = name
    /** @type {Map<object, Set<number>>} conn -> set of clientIDs it controls (for awareness) */
    this.conns = new Map()
    this.awareness = new awarenessProtocol.Awareness(this)
    this.awareness.setLocalState(null)
    this.awareness.on('update', ({ added, updated, removed }, conn) => {
      const changedClients = added.concat(updated, removed)
      if (conn !== null) {
        const controlledIds = this.conns.get(conn)
        if (controlledIds !== undefined) {
          added.forEach((id) => controlledIds.add(id))
          removed.forEach((id) => controlledIds.delete(id))
        }
      }
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageAwareness)
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
      )
      const message = encoding.toUint8Array(encoder)
      this.conns.forEach((_, c) => send(this, c, message))
    })
    this.on('update', updateHandler)
  }
}

const getYDoc = (docName) => {
  let doc = docs.get(docName)
  if (doc === undefined) {
    doc = new WSSharedDoc(docName)
    docs.set(docName, doc)
    persistence.bindState(docName, doc)
  }
  return doc
}

const messageListener = (conn, doc, message) => {
  try {
    const encoder = encoding.createEncoder()
    const decoder = decoding.createDecoder(message)
    const messageType = decoding.readVarUint(decoder)
    switch (messageType) {
      case messageSync:
        encoding.writeVarUint(encoder, messageSync)
        syncProtocol.readSyncMessage(decoder, encoder, doc, conn)
        // If the reply has content beyond the leading message-type byte, send it.
        if (encoding.length(encoder) > 1) send(doc, conn, encoding.toUint8Array(encoder))
        break
      case messageAwareness:
        awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(decoder), conn)
        break
    }
  } catch (err) {
    console.error('Caught error while handling a Yjs message', err)
    doc.emit('error', [err])
  }
}

const setupWSConnection = (conn, req) => {
  conn.binaryType = 'arraybuffer'
  const docName = (req.url || '').slice(1).split('?')[0] || 'default'
  const doc = getYDoc(docName)
  doc.conns.set(conn, new Set())

  conn.on('message', (message) => messageListener(conn, doc, new Uint8Array(message)))

  // Keepalive: drop connections that stop responding to pings.
  let pongReceived = true
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) closeConn(doc, conn)
      clearInterval(pingInterval)
    } else if (doc.conns.has(conn)) {
      pongReceived = false
      try {
        conn.ping()
      } catch {
        closeConn(doc, conn)
        clearInterval(pingInterval)
      }
    }
  }, PING_TIMEOUT)
  conn.on('close', () => {
    closeConn(doc, conn)
    clearInterval(pingInterval)
  })
  conn.on('pong', () => {
    pongReceived = true
  })

  // Initial handshake: send sync step 1 + our current awareness states.
  {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeSyncStep1(encoder, doc)
    send(doc, conn, encoding.toUint8Array(encoder))
    const states = doc.awareness.getStates()
    if (states.size > 0) {
      const awarenessEncoder = encoding.createEncoder()
      encoding.writeVarUint(awarenessEncoder, messageAwareness)
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(states.keys())),
      )
      send(doc, conn, encoding.toUint8Array(awarenessEncoder))
    }
  }
}

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('ChronoKanban collab server\n')
})

const wss = new WebSocketServer({
  server,
  verifyClient: (info, callback) => {
    if (!AUTH_TOKEN) return callback(true)
    const token = new URL(info.req.url, 'http://localhost').searchParams.get('token')
    if (token === AUTH_TOKEN) return callback(true)
    callback(false, 401, 'Unauthorized')
  },
})
wss.on('connection', (conn, req) => setupWSConnection(conn, req))

server.listen(PORT, HOST, () => {
  console.log(`ChronoKanban collab server listening on ws://${HOST}:${PORT} (persistence: ${DATA_DIR})`)
})
