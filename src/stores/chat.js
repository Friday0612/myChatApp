import { defineStore } from 'pinia'

const STORAGE_KEY = 'mychatapp.sessions.v1'
const DEFAULT_ENDPOINT = '/api/chat'
const SESSION_LIMIT = 30

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function deriveTitle(prompt) {
  const compact = prompt.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return 'New chat'
  }
  return compact.length > 30 ? `${compact.slice(0, 30)}...` : compact
}

function createWelcomeMessage() {
  return {
    id: createId('msg'),
    role: 'assistant',
    content: 'Hello! I am your AI assistant. Ask anything and I will respond in streaming mode.',
    createdAt: nowIso(),
  }
}

function createSession(title = 'New chat') {
  const timestamp = nowIso()
  return {
    id: createId('session'),
    title,
    pinned: false,
    pinnedAt: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [createWelcomeMessage()],
  }
}

function parsePayload(raw) {
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function normalizeMessage(message, index) {
  if (!message || typeof message !== 'object') {
    return null
  }

  if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') {
    return null
  }

  return {
    id: message.id || `msg_restored_${index}_${createId('m')}`,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt || nowIso(),
  }
}

function normalizeSession(session, index) {
  if (!session || typeof session !== 'object' || !Array.isArray(session.messages)) {
    return null
  }

  const messages = session.messages
    .map((message, messageIndex) => normalizeMessage(message, messageIndex))
    .filter(Boolean)

  if (!messages.length) {
    messages.push(createWelcomeMessage())
  }

  const createdAt = session.createdAt || nowIso()
  return {
    id: session.id || `session_restored_${index}_${createId('s')}`,
    title: typeof session.title === 'string' && session.title.trim() ? session.title : 'New chat',
    pinned: Boolean(session.pinned),
    pinnedAt: typeof session.pinnedAt === 'string' ? session.pinnedAt : '',
    createdAt,
    updatedAt: session.updatedAt || createdAt,
    messages,
  }
}

function parseEventPayload(payload, currentText) {
  let parsed

  try {
    parsed = JSON.parse(payload)
  } catch {
    return { type: 'skip' }
  }

  if (parsed.error) {
    return {
      type: 'error',
      message: typeof parsed.error === 'string' ? parsed.error : 'Unknown stream error',
    }
  }

  const choice = parsed.choices?.[0]
  if (!choice) {
    return { type: 'skip' }
  }

  const deltaContent = choice.delta?.content
  if (typeof deltaContent === 'string' && deltaContent) {
    return { type: 'append', text: deltaContent }
  }

  const messageContent = choice.message?.content
  if (typeof messageContent === 'string' && messageContent) {
    if (currentText && messageContent.startsWith(currentText)) {
      return { type: 'replace', text: messageContent }
    }
    return { type: 'append', text: messageContent }
  }

  const plainText = choice.text
  if (typeof plainText === 'string' && plainText) {
    return { type: 'append', text: plainText }
  }

  return { type: 'skip' }
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    sessions: [],
    activeSessionId: '',
    isStreaming: false,
    streamError: '',
    pendingMessageId: '',
    abortController: null,
  }),

  getters: {
    activeSession(state) {
      return state.sessions.find((session) => session.id === state.activeSessionId) || null
    },

    activeMessages() {
      return this.activeSession?.messages || []
    },

    orderedSessions(state) {
      // 置顶会话优先，其次按最近更新时间排序。
      return [...state.sessions].sort((a, b) => {
        const aPinned = Boolean(a.pinned)
        const bPinned = Boolean(b.pinned)

        if (aPinned !== bPinned) {
          return aPinned ? -1 : 1
        }

        if (aPinned && bPinned) {
          const pinTimeDiff = new Date(b.pinnedAt || 0) - new Date(a.pinnedAt || 0)
          if (pinTimeDiff !== 0) {
            return pinTimeDiff
          }
        }

        return new Date(b.updatedAt) - new Date(a.updatedAt)
      })
    },
  },

  actions: {
    initialize() {
      if (this.sessions.length) {
        return
      }

      const payload = parsePayload(localStorage.getItem(STORAGE_KEY))
      if (payload?.sessions && Array.isArray(payload.sessions)) {
        this.sessions = payload.sessions
          .map((session, index) => normalizeSession(session, index))
          .filter(Boolean)
          .slice(0, SESSION_LIMIT)

        this.activeSessionId = typeof payload.activeSessionId === 'string' ? payload.activeSessionId : ''
      }

      if (!this.sessions.length) {
        const session = createSession()
        this.sessions = [session]
        this.activeSessionId = session.id
        this.persist()
        return
      }

      if (!this.sessions.some((session) => session.id === this.activeSessionId)) {
        this.activeSessionId = this.sessions[0].id
      }

      this.persist()
    },

    persist() {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sessions: this.sessions,
          activeSessionId: this.activeSessionId,
        }),
      )
    },

    createSessionAndActivate() {
      const session = createSession()
      this.sessions.unshift(session)
      this.sessions = this.sessions.slice(0, SESSION_LIMIT)
      this.activeSessionId = session.id
      this.streamError = ''
      this.persist()
      return session
    },

    activateSession(sessionId) {
      if (this.sessions.some((session) => session.id === sessionId)) {
        this.activeSessionId = sessionId
        this.streamError = ''
        this.persist()
      }
    },

    togglePinSession(sessionId) {
      const session = this.sessions.find((item) => item.id === sessionId)
      if (!session) {
        return
      }

      if (session.pinned) {
        session.pinned = false
        session.pinnedAt = ''
      } else {
        session.pinned = true
        session.pinnedAt = nowIso()
      }

      this.persist()
    },

    renameSession(sessionId, title) {
      const nextTitle = String(title || '').trim()
      if (!nextTitle) {
        return false
      }

      const session = this.sessions.find((item) => item.id === sessionId)
      if (!session) {
        return false
      }

      session.title = nextTitle
      session.updatedAt = nowIso()
      this.persist()
      return true
    },

    deleteSession(sessionId) {
      if (this.isStreaming && this.activeSessionId === sessionId) {
        this.stopGenerating()
      }

      this.sessions = this.sessions.filter((session) => session.id !== sessionId)

      if (!this.sessions.length) {
        const session = createSession()
        this.sessions = [session]
        this.activeSessionId = session.id
      } else if (!this.sessions.some((session) => session.id === this.activeSessionId)) {
        this.activeSessionId = this.sessions[0].id
      }

      this.persist()
    },

    clearActiveSession() {
      const session = this.activeSession
      if (!session || this.isStreaming) {
        return
      }

      session.title = 'New chat'
      session.messages = [createWelcomeMessage()]
      session.updatedAt = nowIso()
      this.streamError = ''
      this.persist()
    },

    async sendPrompt(prompt, options = {}) {
      const trimmed = String(prompt || '').trim()
      if (!trimmed || this.isStreaming) {
        return
      }

      let session = this.activeSession
      if (!session) {
        session = this.createSessionAndActivate()
      }

      const userMessage = {
        id: createId('msg'),
        role: 'user',
        content: trimmed,
        createdAt: nowIso(),
      }

      session.messages.push(userMessage)
      session.updatedAt = nowIso()

      const userMessageCount = session.messages.filter((message) => message.role === 'user').length
      if (session.title === 'New chat' && userMessageCount === 1) {
        session.title = deriveTitle(trimmed)
      }

      this.persist()
      await this.streamAssistantReply(session, options)
    },

    async regenerateLastReply(options = {}) {
      if (this.isStreaming) {
        return
      }

      const session = this.activeSession
      if (!session) {
        return
      }

      let lastUserIndex = -1
      for (let i = session.messages.length - 1; i >= 0; i -= 1) {
        if (session.messages[i].role === 'user') {
          lastUserIndex = i
          break
        }
      }

      if (lastUserIndex === -1) {
        return
      }

      session.messages = session.messages.slice(0, lastUserIndex + 1)
      session.updatedAt = nowIso()
      this.persist()
      await this.streamAssistantReply(session, options)
    },

    stopGenerating() {
      if (this.abortController) {
        this.abortController.abort()
      }
    },

    async streamAssistantReply(session, options = {}) {
      if (!session || this.isStreaming) {
        return
      }

      const endpoint = options.endpoint || DEFAULT_ENDPOINT
      const sessionId = session.id
      const targetSession = this.sessions.find((item) => item.id === sessionId)
      if (!targetSession) {
        return
      }

      const assistantMessageId = createId('msg')
      targetSession.messages.push({
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: nowIso(),
        status: 'streaming',
      })

      const assistantMessage = targetSession.messages[targetSession.messages.length - 1]
      targetSession.updatedAt = nowIso()

      this.isStreaming = true
      this.streamError = ''
      this.pendingMessageId = assistantMessageId
      this.persist()

      const controller = new AbortController()
      this.abortController = controller

      try {
        const payloadMessages = targetSession.messages
          .filter((message) => message.id !== assistantMessageId)
          .map(({ role, content }) => ({ role, content }))

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: payloadMessages,
            stream: true,
          }),
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          throw new Error(`Chat request failed (${response.status})`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let pendingChunk = ''

        // 按 SSE 行协议解析 data: 片段，实时拼接 AI 回复。
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }

          pendingChunk += decoder.decode(value, { stream: true })
          const lines = pendingChunk.split(/\r?\n/)
          pendingChunk = lines.pop() || ''

          for (const rawLine of lines) {
            const line = rawLine.trim()
            if (!line || !line.startsWith('data:')) {
              continue
            }

            const payload = line.slice(5).trim()
            if (!payload) {
              continue
            }

            if (payload === '[DONE]') {
              pendingChunk = ''
              break
            }

            const event = parseEventPayload(payload, assistantMessage.content)
            if (event.type === 'error') {
              throw new Error(event.message)
            }

            if (event.type === 'append' && event.text) {
              assistantMessage.content += event.text
            }

            if (event.type === 'replace') {
              assistantMessage.content = event.text
            }
          }
        }

        const tail = decoder.decode()
        if (tail && tail.trim()) {
          const maybeLine = tail.trim()
          if (maybeLine.startsWith('data:')) {
            const payload = maybeLine.slice(5).trim()
            if (payload && payload !== '[DONE]') {
              const event = parseEventPayload(payload, assistantMessage.content)
              if (event.type === 'append' && event.text) {
                assistantMessage.content += event.text
              } else if (event.type === 'replace') {
                assistantMessage.content = event.text
              }
            }
          }
        }

        if (!assistantMessage.content.trim()) {
          assistantMessage.content = 'No content returned by the model.'
        }
      } catch (error) {
        if (error?.name === 'AbortError') {
          // 用户主动中断时保留已生成内容，空内容给出提示。
          if (!assistantMessage.content.trim()) {
            assistantMessage.content = 'Generation stopped by user.'
          }
        } else {
          this.streamError = error?.message || 'Unknown streaming error'
          if (!assistantMessage.content.trim()) {
            assistantMessage.content = `Request failed: ${this.streamError}`
          }
        }
      } finally {
        assistantMessage.status = 'done'
        delete assistantMessage.status

        targetSession.updatedAt = nowIso()
        this.isStreaming = false
        this.pendingMessageId = ''
        this.abortController = null
        this.persist()
      }
    },
  },
})
