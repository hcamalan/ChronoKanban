import http from 'http'
import { WebSocketServer } from 'ws'
import * as Y from 'yjs'
import { LeveldbPersistence } from 'y-leveldb'
import { setupWSConnection, setPersistence } from '@y/websocket-server/utils'

/**
 * ChronoKanban self-hostable realtime sync server.
 *
 * A thin wrapper around @y/websocket-server's connection handler: clients open a WebSocket per
 * room (the room name is the URL path; the ChronoKanban client uses "chronokanban"), and Yjs sync
 * + awareness messages are relayed between all connections to that room. The room's document is
 * persisted to LevelDB so it survives restarts. No auth or static-file serving yet — those come
 * with the Docker/deploy step.
 */

const PORT = Number(process.env.PORT) || 1234
const HOST = process.env.HOST || '0.0.0.0'
const DATA_DIR = process.env.YPERSISTENCE || './data'

// Durable storage: load a room's persisted state into its doc on first open, then stream every
// subsequent update back to LevelDB. Standard y-websocket + y-leveldb binding.
const ldb = new LeveldbPersistence(DATA_DIR)
setPersistence({
  provider: ldb,
  bindState: async (docName, ydoc) => {
    const persisted = await ldb.getYDoc(docName)
    // Merge anything the connecting client already had into the persisted store, and vice versa.
    ldb.storeUpdate(docName, Y.encodeStateAsUpdate(ydoc))
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persisted))
    ydoc.on('update', (update) => {
      ldb.storeUpdate(docName, update)
    })
  },
  writeState: async () => {},
})

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('ChronoKanban collab server\n')
})

const wss = new WebSocketServer({ server })
wss.on('connection', (conn, req) => setupWSConnection(conn, req))

server.listen(PORT, HOST, () => {
  console.log(`ChronoKanban collab server listening on ws://${HOST}:${PORT} (persistence: ${DATA_DIR})`)
})
