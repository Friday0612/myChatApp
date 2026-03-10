<script setup>
import { computed, defineAsyncComponent, onMounted } from 'vue'
import { useChatStore } from '../stores/chat'

const SessionSidebar = defineAsyncComponent(() => import('../components/chat/SessionSidebar.vue'))
const MessageList = defineAsyncComponent(() => import('../components/chat/MessageList.vue'))
const ChatBox = defineAsyncComponent(() => import('../components/chat/ChatBox.vue'))

const chatStore = useChatStore()

const sessions = computed(() => chatStore.orderedSessions)
const activeSessionTitle = computed(() => chatStore.activeSession?.title || 'New chat')
const canRegenerate = computed(() => chatStore.activeMessages.some((message) => message.role === 'user'))

function createChat() {
  chatStore.createSessionAndActivate()
}

function selectChat(sessionId) {
  chatStore.activateSession(sessionId)
}

function deleteChat(sessionId) {
  chatStore.deleteSession(sessionId)
}

function togglePin(sessionId) {
  chatStore.togglePinSession(sessionId)
}

function renameChat({ sessionId, title }) {
  chatStore.renameSession(sessionId, title)
}

async function sendPrompt(prompt) {
  await chatStore.sendPrompt(prompt)
}

async function regenerate() {
  if (!canRegenerate.value) {
    return
  }

  await chatStore.regenerateLastReply()
}

function stopGenerating() {
  chatStore.stopGenerating()
}

function clearCurrentChat() {
  chatStore.clearActiveSession()
}

onMounted(() => {
  chatStore.initialize()
})
</script>

<template>
  <div class="chat-page">
    <Suspense>
      <template #default>
        <SessionSidebar
          :sessions="sessions"
          :active-session-id="chatStore.activeSessionId"
          :is-streaming="chatStore.isStreaming"
          @create="createChat"
          @select="selectChat"
          @delete="deleteChat"
          @pin="togglePin"
          @rename="renameChat"
        />
      </template>
      <template #fallback>
        <aside class="sidebar-fallback">Loading sessions...</aside>
      </template>
    </Suspense>

    <main class="chat-main">
      <header class="chat-header">
        <div>
          <h1>{{ activeSessionTitle }}</h1>
          <p>{{ chatStore.isStreaming ? 'Assistant is responding...' : 'Ready for your next prompt.' }}</p>
        </div>

        <div class="header-actions">
          <button type="button" :disabled="chatStore.isStreaming || !canRegenerate" @click="regenerate">Regenerate</button>
        </div>
      </header>

      <Suspense>
        <template #default>
          <MessageList :messages="chatStore.activeMessages" :is-streaming="chatStore.isStreaming" />
        </template>
        <template #fallback>
          <section class="messages-fallback">Loading messages...</section>
        </template>
      </Suspense>

      <Suspense>
        <template #default>
          <ChatBox
            :is-streaming="chatStore.isStreaming"
            :stream-error="chatStore.streamError"
            @send="sendPrompt"
            @stop="stopGenerating"
            @regenerate="regenerate"
          />
        </template>
        <template #fallback>
          <section class="composer-fallback">Loading composer...</section>
        </template>
      </Suspense>
    </main>
  </div>
</template>

<style scoped>
.chat-page {
  height: 100vh;
  display: flex;
  background: radial-gradient(circle at top right, #e8f4ff 0%, #d5e8f9 38%, #c5d9ea 100%);
}

.chat-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: rgba(246, 251, 255, 0.82);
  backdrop-filter: blur(8px);
}

.chat-header {
  padding: 18px 20px;
  border-bottom: 1px solid rgba(15, 37, 62, 0.12);
  background: rgba(255, 255, 255, 0.72);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  position: sticky;
}

.chat-header h1 {
  margin: 0;
  font-size: 20px;
  line-height: 1.3;
  color: #132e4b;
}

.chat-header p {
  margin: 5px 0 0;
  color: #52779c;
  font-size: 13px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-actions button {
  border: 1px solid #b4cee6;
  border-radius: 10px;
  background: #f5f9fd;
  color: #284b70;
  font-size: 13px;
  font-weight: 650;
  padding: 8px 12px;
  cursor: pointer;
}

.header-actions button:hover:not(:disabled) {
  background: #e7f1fb;
}

.header-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.sidebar-fallback,
.messages-fallback,
.composer-fallback {
  display: grid;
  place-items: center;
  color: #496b90;
  font-size: 14px;
}

.sidebar-fallback {
  width: 280px;
  min-width: 280px;
  background: #101a2a;
  color: #d5e6f7;
  border-right: 1px solid rgba(255, 255, 255, 0.12);
}

.messages-fallback {
  flex: 1;
}

.composer-fallback {
  border-top: 1px solid rgba(15, 37, 62, 0.12);
  padding: 14px;
}

@media (max-width: 920px) {
  .chat-page {
    flex-direction: column;
    height: 100dvh;
  }

  .chat-header {
    padding: 14px;
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions button {
    flex: 1;
  }

  .sidebar-fallback {
    width: 100%;
    min-width: 0;
    height: 140px;
  }
}
</style>
