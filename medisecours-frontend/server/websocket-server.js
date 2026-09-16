const { WebSocketServer } = require('ws')
const http = require('http')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const PORT = Number(process.env.PORT || process.env.WS_PORT || 8081)
const HOST = process.env.HOST || process.env.WS_HOST || '0.0.0.0'
const PUBLISH_SECRET = process.env.WS_PUBLISH_SECRET
const MAX_PUBLISH_BODY_BYTES = 256 * 1024
const MAX_WS_PAYLOAD_BYTES = 64 * 1024
const MAX_CONNECTIONS_PER_IP = 10
const MAX_TOTAL_CONNECTIONS = 5000
const MAX_MESSAGES_PER_MINUTE = 60
const MAX_TARGET_USERS = 1000
const AUTH_TIMEOUT_MS = 10_000
const HEARTBEAT_INTERVAL_MS = 30_000
const ALLOWED_ORIGINS = new Set(
  (process.env.WS_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)
const ALLOWED_EVENTS = new Set([
  'new_message',
  'message_delivered',
  'message_read',
  'consultation_created',
  'consultation_accepted',
  'consultation_closed',
  'profile_photo_changed',
  'language_changed',
  'user_online',
  'user_offline',
])

if (!PUBLISH_SECRET || PUBLISH_SECRET.length < 32) {
  throw new Error('WS_PUBLISH_SECRET must contain at least 32 characters')
}

function loadPublicKey() {
  if (process.env.JWT_PUBLIC_KEY_BASE64) {
    return Buffer.from(process.env.JWT_PUBLIC_KEY_BASE64, 'base64').toString('utf8')
  }

  const publicKeyPath = process.env.JWT_PUBLIC_KEY
    || path.resolve(__dirname, '../../medisecours-backend/config/jwt/public.pem')
  return fs.readFileSync(publicKeyPath, 'utf8')
}

const PUBLIC_KEY = loadPublicKey()
const clients = new Map()
const connectionsByIp = new Map()

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: MAX_WS_PAYLOAD_BYTES,
  perMessageDeflate: false,
})

wss.on('connection', (ws, req) => {
  const remoteIp = req.socket.remoteAddress || 'unknown'
  const ipConnections = connectionsByIp.get(remoteIp) || 0
  if (wss.clients.size > MAX_TOTAL_CONNECTIONS || ipConnections >= MAX_CONNECTIONS_PER_IP) {
    ws.close(4008, 'Too many connections')
    return
  }
  connectionsByIp.set(remoteIp, ipConnections + 1)

  ws.authenticated = false
  ws.userId = null
  ws.role = null
  ws.isAlive = true
  ws.messageWindowStartedAt = Date.now()
  ws.messageCount = 0

  ws.on('pong', () => {
    ws.isAlive = true
  })

  const authTimer = setTimeout(() => {
    if (!ws.authenticated) ws.close(4002, 'Auth timeout')
  }, AUTH_TIMEOUT_MS)

  ws.on('message', (raw) => {
    const now = Date.now()
    if (now - ws.messageWindowStartedAt >= 60_000) {
      ws.messageWindowStartedAt = now
      ws.messageCount = 0
    }
    ws.messageCount += 1
    if (ws.messageCount > MAX_MESSAGES_PER_MINUTE) {
      ws.close(4008, 'Rate limit exceeded')
      return
    }

    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }

    if (msg.type === 'auth') {
      if (ws.authenticated) return

      try {
        const decoded = jwt.verify(msg.token, PUBLIC_KEY, {
          algorithms: ['RS256'],
          issuer: process.env.JWT_ISSUER || 'medisecours-api',
          audience: process.env.JWT_AUDIENCE || 'medisecours-websocket',
        })
        const userId = decoded.sub
        if (!userId) {
          ws.close(4003, 'Invalid token: no subject')
          return
        }

        clearTimeout(authTimer)
        ws.authenticated = true
        ws.userId = String(userId)
        ws.role = Array.isArray(decoded.roles) && decoded.roles[0]
          ? decoded.roles[0].replace('ROLE_', '').toLowerCase()
          : ''

        if (!clients.has(ws.userId)) clients.set(ws.userId, new Set())
        clients.get(ws.userId).add(ws)
        ws.send(JSON.stringify({ type: 'auth_ok', userId: ws.userId }))
      } catch {
        ws.close(4003, 'Invalid token')
      }
      return
    }

    if (!ws.authenticated) {
      ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }))
      return
    }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }))
      return
    }

    if (msg.type === 'language_change') {
      const locale = typeof msg.locale === 'string' ? msg.locale : ''
      if (!['fr', 'en'].includes(locale) || !ws.userId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Unsupported locale' }))
        return
      }

      sendToTargets('language_changed', { locale }, [ws.userId])
      return
    }

    if (msg.type === 'subscribe' || msg.type === 'unsubscribe') {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Conversation subscriptions are server-managed',
      }))
    }
  })

  ws.on('close', () => {
    clearTimeout(authTimer)
    const remaining = (connectionsByIp.get(remoteIp) || 1) - 1
    if (remaining > 0) connectionsByIp.set(remoteIp, remaining)
    else connectionsByIp.delete(remoteIp)
    if (!ws.userId) return
    clients.get(ws.userId)?.delete(ws)
    if (clients.get(ws.userId)?.size === 0) clients.delete(ws.userId)
  })
})

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate()
      continue
    }
    ws.isAlive = false
    ws.ping()
  }
}, HEARTBEAT_INTERVAL_MS)

wss.on('close', () => clearInterval(heartbeat))

function isAuthorizedPublisher(req) {
  const header = req.headers['x-ws-publish-secret']
  const expected = Buffer.from(PUBLISH_SECRET)
  const received = Buffer.from(typeof header === 'string' ? header : '')
  return received.length === expected.length && crypto.timingSafeEqual(received, expected)
}

function sendToTargets(event, payload, targetUserIds) {
  const message = JSON.stringify({ event, payload })
  let sent = 0

  for (const userId of targetUserIds) {
    const sockets = clients.get(String(userId))
    if (!sockets) continue
    for (const ws of sockets) {
      if (ws.readyState === 1 && ws.authenticated) {
        ws.send(message)
        sent++
      }
    }
  }

  return sent
}

const httpServer = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET' && requestUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      authenticatedUsers: clients.size,
      connections: wss.clients.size,
    }))
    return
  }

  if (req.method !== 'POST' || requestUrl.pathname !== '/publish') {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  if (!isAuthorizedPublisher(req)) {
    res.writeHead(401)
    res.end('Unauthorized')
    return
  }

  let body = ''
  let bodyBytes = 0
  req.on('data', (chunk) => {
    bodyBytes += chunk.length
    if (bodyBytes > MAX_PUBLISH_BODY_BYTES) {
      res.writeHead(413)
      res.end('Payload too large')
      req.destroy()
      return
    }
    body += chunk
  })

  req.on('end', () => {
    if (bodyBytes > MAX_PUBLISH_BODY_BYTES) return

    try {
      const data = JSON.parse(body)
      const { event, payload, broadcast, targetUserIds } = data
      if (!ALLOWED_EVENTS.has(event)) {
        res.writeHead(400)
        res.end('Unsupported event')
        return
      }

      let targets
      if (broadcast === true) {
        targets = [...clients.keys()]
      } else if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
        targets = [...new Set(targetUserIds.map(String))]
      } else {
        res.writeHead(400)
        res.end('Explicit targetUserIds are required')
        return
      }
      if (targets.length > MAX_TARGET_USERS) {
        res.writeHead(413)
        res.end('Too many targets')
        return
      }

      const sent = sendToTargets(event, payload, targets)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ sent }))
    } catch {
      res.writeHead(400)
      res.end('Invalid JSON')
    }
  })
})

httpServer.on('upgrade', (req, socket, head) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const origin = req.headers.origin || ''

  if (requestUrl.pathname !== '/ws' || !ALLOWED_ORIGINS.has(origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req)
  })
})

httpServer.listen(PORT, HOST, () => {
  console.log(`[WS] Service listening on http://${HOST}:${PORT}`)
  console.log(`[WS] WebSocket endpoint available at /ws`)
  console.log(`[WS] Publisher endpoint available at /publish`)
})
