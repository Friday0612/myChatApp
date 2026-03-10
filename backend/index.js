const http = require('http')
const https = require('https')
const dotenv = require('dotenv')

dotenv.config()

const PORT = Number(process.env.PORT || 3000)
const API_KEY = process.env.API_KEY
const MAAS_HOST = process.env.MAAS_HOST || 'maas-api.cn-huabei-1.xf-yun.com'
const MAAS_PATH = process.env.MAAS_PATH || '/v1/chat/completions'
const MODEL_ID = process.env.MODEL_ID || 'xopdeepseekv32'

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function writeSse(res, payload) {
  res.write(`data: ${payload}\n\n`)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''

    req.on('data', (chunk) => {
      raw += chunk
      // 保护服务端，限制单次请求体大小。
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'))
        req.destroy()
      }
    })

    req.on('end', () => {
      if (!raw) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })

    req.on('error', reject)
  })
}

function normalizeMessages(input) {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const role = item.role
      const content = item.content

      if ((role !== 'user' && role !== 'assistant' && role !== 'system') || typeof content !== 'string') {
        return null
      }

      const trimmed = content.trim()
      if (!trimmed) {
        return null
      }

      return { role, content: trimmed }
    })
    .filter(Boolean)
}

function toFiniteNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function buildUpstreamBody(input) {
  return {
    model: typeof input.model === 'string' && input.model.trim() ? input.model.trim() : MODEL_ID,
    messages: normalizeMessages(input.messages),
    max_tokens: toFiniteNumber(input.max_tokens, 4000),
    temperature: toFiniteNumber(input.temperature, 0.7),
    stream: input.stream !== false,
  }
}

function createUpstreamOptions() {
  return {
    hostname: MAAS_HOST,
    port: 443,
    path: MAAS_PATH,
    method: 'POST',
    timeout: 45000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      Accept: '*/*',
      'User-Agent': 'mychatapp-backend/1.0',
    },
  }
}

function handleStreamResponse(clientRes, upstreamRes) {
  clientRes.statusCode = 200
  clientRes.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  clientRes.setHeader('Cache-Control', 'no-cache, no-transform')
  clientRes.setHeader('Connection', 'keep-alive')
  clientRes.setHeader('X-Accel-Buffering', 'no')

  upstreamRes.pipe(clientRes)

  upstreamRes.on('end', () => {
    if (!clientRes.writableEnded) {
      writeSse(clientRes, '[DONE]')
      clientRes.end()
    }
  })
}

function handleNonStreamResponse(clientRes, upstreamRes) {
  let output = ''

  upstreamRes.on('data', (chunk) => {
    output += chunk
  })

  upstreamRes.on('end', () => {
    if (upstreamRes.statusCode >= 400) {
      sendJson(clientRes, upstreamRes.statusCode, {
        error: output || 'Upstream error',
      })
      return
    }

    let parsed
    try {
      parsed = JSON.parse(output)
    } catch {
      parsed = { raw: output }
    }

    sendJson(clientRes, 200, parsed)
  })
}

function proxyToUpstream(payload, clientReq, clientRes) {
  const upstreamReq = https.request(createUpstreamOptions(), (upstreamRes) => {
    if (upstreamRes.statusCode >= 400) {
      let errorBody = ''
      upstreamRes.on('data', (chunk) => {
        errorBody += chunk
      })

      upstreamRes.on('end', () => {
        if (payload.stream) {
          if (!clientRes.headersSent) {
            clientRes.statusCode = 200
            clientRes.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
            clientRes.setHeader('Cache-Control', 'no-cache, no-transform')
            clientRes.setHeader('Connection', 'keep-alive')
          }

          writeSse(clientRes, JSON.stringify({ error: errorBody || `Upstream status ${upstreamRes.statusCode}` }))
          writeSse(clientRes, '[DONE]')
          clientRes.end()
        } else {
          sendJson(clientRes, upstreamRes.statusCode, {
            error: errorBody || `Upstream status ${upstreamRes.statusCode}`,
          })
        }
      })
      return
    }

    if (payload.stream) {
      handleStreamResponse(clientRes, upstreamRes)
    } else {
      handleNonStreamResponse(clientRes, upstreamRes)
    }
  })

  upstreamReq.on('timeout', () => {
    upstreamReq.destroy(new Error('Upstream timeout'))
  })

  upstreamReq.on('error', (error) => {
    if (payload.stream) {
      if (!clientRes.headersSent) {
        clientRes.statusCode = 200
        clientRes.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
        clientRes.setHeader('Cache-Control', 'no-cache, no-transform')
        clientRes.setHeader('Connection', 'keep-alive')
      }

      writeSse(clientRes, JSON.stringify({ error: error.message || 'Upstream request failed' }))
      writeSse(clientRes, '[DONE]')
      clientRes.end()
      return
    }

    sendJson(clientRes, 502, { error: error.message || 'Upstream request failed' })
  })

  clientReq.on('close', () => {
    // 客户端提前断开时，主动中断上游请求，释放连接资源。
    if (!upstreamReq.destroyed) {
      upstreamReq.destroy()
    }
  })

  upstreamReq.write(JSON.stringify(payload))
  upstreamReq.end()
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      service: 'mychatapp-backend',
      timestamp: new Date().toISOString(),
    })
    return
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    if (!API_KEY) {
      sendJson(res, 500, {
        error: 'Missing API_KEY environment variable',
      })
      return
    }

    let body
    try {
      body = await readBody(req)
    } catch (error) {
      sendJson(res, 400, {
        error: error.message || 'Invalid request body',
      })
      return
    }

    const payload = buildUpstreamBody(body)
    if (!payload.messages.length) {
      sendJson(res, 400, {
        error: 'messages must contain at least one valid chat item',
      })
      return
    }

    proxyToUpstream(payload, req, res)
    return
  }

  sendJson(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
  console.log(`AI backend listening at http://localhost:${PORT}`)
  console.log(`Model: ${MODEL_ID}`)
})
