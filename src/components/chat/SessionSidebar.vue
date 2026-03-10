<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

const props = defineProps({
  sessions: {
    type: Array,
    default: () => [],
  },
  activeSessionId: {
    type: String,
    default: '',
  },
  isStreaming: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['create', 'select', 'delete', 'pin', 'rename'])

const openMenuSessionId = ref('')
const deleteConfirmSessionId = ref('')
const renamingSessionId = ref('')
const renameDraft = ref('')
const renameInputRef = ref(null)
const menuRef = ref(null)
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const toastMessage = ref('')

const menuStyle = reactive({
  left: '0px',
  top: '0px',
  width: '120px',
})

const shareDialog = reactive({
  visible: false,
  sessionId: '',
})

const reportDialog = reactive({
  visible: false,
  sessionId: '',
  reason: 'content_error',
})

const menuButtonRefs = new Map()
const cardRefs = new Map()

let toastTimer = null
let deleteConfirmTimer = null

const activeMenuSession = computed(() => props.sessions.find((session) => session.id === openMenuSessionId.value) || null)
const shareSession = computed(() => props.sessions.find((session) => session.id === shareDialog.sessionId) || null)
const reportSession = computed(() => props.sessions.find((session) => session.id === reportDialog.sessionId) || null)

function setMenuButtonRef(sessionId, el) {
  if (el) {
    menuButtonRefs.set(sessionId, el)
  } else {
    menuButtonRefs.delete(sessionId)
  }
}

function setCardRef(sessionId, el) {
  if (el) {
    cardRefs.set(sessionId, el)
  } else {
    cardRefs.delete(sessionId)
  }
}

function formatTime(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString()
}

function showToast(message, duration = 2200) {
  toastMessage.value = message

  if (toastTimer) {
    clearTimeout(toastTimer)
  }

  toastTimer = window.setTimeout(() => {
    toastMessage.value = ''
  }, duration)
}

function clearDeleteConfirmTimer() {
  if (deleteConfirmTimer) {
    clearTimeout(deleteConfirmTimer)
    deleteConfirmTimer = null
  }
}

function closeMenu() {
  openMenuSessionId.value = ''
  deleteConfirmSessionId.value = ''
  clearDeleteConfirmTimer()
}

function closeShareDialog() {
  shareDialog.visible = false
  shareDialog.sessionId = ''
}

function closeReportDialog() {
  reportDialog.visible = false
  reportDialog.sessionId = ''
  reportDialog.reason = 'content_error'
}

function updateViewport() {
  viewportWidth.value = window.innerWidth

  if (openMenuSessionId.value) {
    nextTick(() => {
      positionMenu(openMenuSessionId.value)
    })
  }
}

function positionMenu(sessionId) {
  const trigger = menuButtonRefs.get(sessionId)
  if (!trigger) {
    return
  }

  const triggerRect = trigger.getBoundingClientRect()

  // 小屏：菜单放在触发按钮下方并尽量与会话项同宽，避免超出视口。
  if (viewportWidth.value <= 920) {
    const card = cardRefs.get(sessionId)
    const cardRect = card?.getBoundingClientRect()
    const width = cardRect ? Math.min(cardRect.width, window.innerWidth - 16) : Math.min(240, window.innerWidth - 16)
    let left = cardRect ? cardRect.left : triggerRect.left

    if (left + width > window.innerWidth - 8) {
      left = window.innerWidth - width - 8
    }

    menuStyle.left = `${Math.max(8, left)}px`
    menuStyle.top = `${triggerRect.bottom + 6}px`
    menuStyle.width = `${Math.max(120, width)}px`
    return
  }

  const width = 120
  let left = triggerRect.right + 8
  const rightBoundary = window.innerWidth - width - 8
  if (left > rightBoundary) {
    left = rightBoundary
  }

  let top = triggerRect.top
  const maxTop = window.innerHeight - 220
  if (top > maxTop) {
    top = Math.max(8, maxTop)
  }

  menuStyle.left = `${Math.max(8, left)}px`
  menuStyle.top = `${Math.max(8, top)}px`
  menuStyle.width = `${width}px`
}

function toggleMenu(sessionId) {
  if (openMenuSessionId.value === sessionId) {
    closeMenu()
    return
  }

  openMenuSessionId.value = sessionId
  deleteConfirmSessionId.value = ''
  clearDeleteConfirmTimer()

  nextTick(() => {
    positionMenu(sessionId)
  })
}

function handleGlobalPointerDown(event) {
  if (!openMenuSessionId.value) {
    return
  }

  const target = event.target
  if (menuRef.value?.contains(target)) {
    return
  }

  const trigger = menuButtonRefs.get(openMenuSessionId.value)
  if (trigger?.contains(target)) {
    return
  }

  closeMenu()
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') {
    return
  }

  if (reportDialog.visible) {
    closeReportDialog()
    return
  }

  if (shareDialog.visible) {
    closeShareDialog()
    return
  }

  if (openMenuSessionId.value) {
    closeMenu()
    return
  }

  if (renamingSessionId.value) {
    cancelRename()
  }
}

function handleSessionListScroll() {
  if (openMenuSessionId.value) {
    closeMenu()
  }
}

function handleSelect(sessionId) {
  emit('select', sessionId)
}

function togglePin(session) {
  if (!session) {
    return
  }

  emit('pin', session.id)
  closeMenu()
}

function beginRename(session) {
  if (!session) {
    return
  }

  renamingSessionId.value = session.id
  renameDraft.value = session.title
  closeMenu()

  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

function cancelRename() {
  renamingSessionId.value = ''
  renameDraft.value = ''
}

function commitRename(sessionId) {
  if (renamingSessionId.value !== sessionId) {
    return
  }

  const nextTitle = renameDraft.value.trim()
  if (!nextTitle) {
    showToast('名称不能为空')
    cancelRename()
    return
  }

  emit('rename', {
    sessionId,
    title: nextTitle,
  })

  renamingSessionId.value = ''
  renameDraft.value = ''
}

function onRenameInputKeydown(event, sessionId) {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitRename(sessionId)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    cancelRename()
  }
}

function requestDelete(sessionId) {
  // 删除二次确认仅保留 3 秒，降低误触风险。
  deleteConfirmSessionId.value = sessionId
  clearDeleteConfirmTimer()

  deleteConfirmTimer = window.setTimeout(() => {
    deleteConfirmSessionId.value = ''
  }, 3000)
}

function confirmDelete(sessionId) {
  clearDeleteConfirmTimer()
  deleteConfirmSessionId.value = ''
  emit('delete', sessionId)
  closeMenu()
}

function cancelDeleteConfirm() {
  clearDeleteConfirmTimer()
  deleteConfirmSessionId.value = ''
}

function openShareDialog(session) {
  if (!session) {
    return
  }

  shareDialog.visible = true
  shareDialog.sessionId = session.id
  closeMenu()
}

function openReportDialog(session) {
  if (!session) {
    return
  }

  reportDialog.visible = true
  reportDialog.sessionId = session.id
  reportDialog.reason = 'content_error'
  closeMenu()
}

function fallbackCopyText(text) {
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  document.execCommand('copy')
  document.body.removeChild(textArea)
}

async function copyShareLink() {
  const session = shareSession.value
  if (!session) {
    return
  }

  const url = new URL(window.location.href)
  url.searchParams.set('session', session.id)
  const text = url.toString()

  try {
    await navigator.clipboard.writeText(text)
  } catch {
    fallbackCopyText(text)
  }

  closeShareDialog()
  showToast('链接已复制')
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 6) {
  const words = String(text || '').split(/\s+/)
  let line = ''
  let lineCount = 0

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    const width = ctx.measureText(candidate).width

    if (width > maxWidth && line) {
      ctx.fillText(line, x, y)
      y += lineHeight
      line = word
      lineCount += 1

      if (lineCount >= maxLines - 1) {
        break
      }
    } else {
      line = candidate
    }
  }

  if (line) {
    const finalLine = lineCount >= maxLines - 1 && words.length > 1 ? `${line.slice(0, 76)}...` : line
    ctx.fillText(finalLine, x, y)
  }
}

function exportShareImage() {
  const session = shareSession.value
  if (!session) {
    return
  }

  const latestMessage = [...session.messages]
    .reverse()
    .find((message) => message.role === 'assistant' || message.role === 'user')

  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    showToast('生成图片失败')
    return
  }

  const gradient = ctx.createLinearGradient(0, 0, 1200, 630)
  gradient.addColorStop(0, '#f3f8ff')
  gradient.addColorStop(1, '#e4effa')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1200, 630)

  ctx.fillStyle = '#0f2d49'
  ctx.font = '600 44px Segoe UI'
  ctx.fillText(session.title || 'AI Chat Share', 70, 120)

  ctx.fillStyle = '#35597d'
  ctx.font = '24px Segoe UI'
  ctx.fillText(`Updated: ${formatTime(session.updatedAt)}`, 70, 170)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(70, 210, 1060, 320)
  ctx.strokeStyle = '#d5e3f1'
  ctx.strokeRect(70, 210, 1060, 320)

  ctx.fillStyle = '#13385a'
  ctx.font = '500 24px Segoe UI'
  ctx.fillText('Conversation Snapshot', 96, 258)

  ctx.fillStyle = '#244b71'
  ctx.font = '400 22px Segoe UI'
  drawWrappedText(ctx, latestMessage?.content || 'No message preview available.', 96, 304, 1000, 38)

  ctx.fillStyle = '#4f7397'
  ctx.font = '400 20px Segoe UI'
  ctx.fillText('Generated by myChatApp', 70, 580)

  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = `${session.title || 'chat-share'}.png`
  link.click()

  closeShareDialog()
  showToast('分享图片已生成')
}

function submitReport() {
  if (!reportDialog.sessionId) {
    return
  }

  closeReportDialog()
  showToast('举报已提交，感谢反馈')
}

onMounted(() => {
  window.addEventListener('pointerdown', handleGlobalPointerDown)
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('resize', updateViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleGlobalPointerDown)
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('resize', updateViewport)

  if (toastTimer) {
    clearTimeout(toastTimer)
  }

  clearDeleteConfirmTimer()
})
</script>

<template>
  <aside class="session-sidebar">
    <div class="sidebar-header">
      <h2>AI Assistant</h2>
      <button class="new-chat-btn" type="button" @click="emit('create')">New chat</button>
    </div>

    <div class="session-list" role="list" @scroll.passive="handleSessionListScroll">
      <article
        v-for="session in props.sessions"
        :key="session.id"
        :ref="(el) => setCardRef(session.id, el)"
        class="session-card"
        :class="{
          active: session.id === props.activeSessionId,
          'menu-open': openMenuSessionId === session.id,
        }"
        role="button"
        tabindex="0"
        @click="handleSelect(session.id)"
        @keydown.enter.prevent="handleSelect(session.id)"
        @keydown.space.prevent="handleSelect(session.id)"
      >
        <div class="session-main">
          <div class="session-title-row">
            <template v-if="renamingSessionId === session.id">
              <input
                ref="renameInputRef"
                v-model="renameDraft"
                class="rename-input"
                maxlength="60"
                @click.stop
                @keydown.stop="onRenameInputKeydown($event, session.id)"
                @blur="commitRename(session.id)"
              />
            </template>
            <template v-else>
              <h3>{{ session.title }}</h3>
            </template>
            <span v-if="session.pinned" class="pinned-badge">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M5 2h6l-1 4v3l2 2H4l2-2V6L5 2Z" stroke="currentColor" stroke-width="1.2" />
                <path d="M8 11v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
              </svg>
              置顶
            </span>
          </div>
          <p>{{ formatTime(session.updatedAt) }}</p>
        </div>

        <button
          :ref="(el) => setMenuButtonRef(session.id, el)"
          class="session-more-btn"
          type="button"
          :aria-expanded="openMenuSessionId === session.id"
          :aria-label="`更多操作: ${session.title}`"
          @click.stop="toggleMenu(session.id)"
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="3" cy="8" r="1.3" fill="currentColor" />
            <circle cx="8" cy="8" r="1.3" fill="currentColor" />
            <circle cx="13" cy="8" r="1.3" fill="currentColor" />
          </svg>
        </button>
      </article>
    </div>

    <Transition name="toast-fade">
      <p v-if="toastMessage" class="action-toast">{{ toastMessage }}</p>
    </Transition>
  </aside>

  <Teleport to="body">
    <div v-if="openMenuSessionId" ref="menuRef" class="history-menu" :style="menuStyle" @click.stop>
      <template v-if="deleteConfirmSessionId === openMenuSessionId">
        <div class="delete-confirm">
          <p>确定删除该对话？</p>
          <div class="delete-actions">
            <button type="button" class="confirm-btn" @click="confirmDelete(openMenuSessionId)">确认</button>
            <button type="button" class="cancel-btn" @click="cancelDeleteConfirm">取消</button>
          </div>
        </div>
      </template>
      <template v-else>
        <button type="button" class="menu-item" @click="togglePin(activeMenuSession)">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M8 2v9M5 5l3-3 3 3M3 11h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <span>{{ activeMenuSession?.pinned ? '取消置顶' : '置顶' }}</span>
        </button>

        <button type="button" class="menu-item" @click="openShareDialog(activeMenuSession)">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M10 3h3v3M13 3l-5.5 5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
              <path d="M7 4H4.8A1.8 1.8 0 0 0 3 5.8v5.4A1.8 1.8 0 0 0 4.8 13h5.4a1.8 1.8 0 0 0 1.8-1.8V9" stroke="currentColor" stroke-width="1.3" />
            </svg>
          </span>
          <span>分享</span>
        </button>

        <button type="button" class="menu-item" @click="beginRename(activeMenuSession)">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M3 11.8 3.3 13l1.2.3 6.7-6.8-1.5-1.5L3 11.8Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
              <path d="m9.5 4.8 1.5 1.5M2.6 13.4h10.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            </svg>
          </span>
          <span>重命名</span>
        </button>

        <button type="button" class="menu-item" @click="openReportDialog(activeMenuSession)">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M8 2.4 14 13H2L8 2.4Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
              <path d="M8 6v3.3M8 11.4v.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            </svg>
          </span>
          <span>举报</span>
        </button>

        <button
          type="button"
          class="menu-item danger"
          :disabled="props.isStreaming && activeMenuSession?.id === props.activeSessionId"
          @click="requestDelete(openMenuSessionId)"
        >
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M3 4.5h10M6.2 4.5V3.2h3.6v1.3M5 6.2v6M8 6.2v6m3-6v6M4.2 4.5l.6 8.2h6.4l.6-8.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            </svg>
          </span>
          <span>删除</span>
        </button>
      </template>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="shareDialog.visible" class="dialog-overlay" @click.self="closeShareDialog">
      <section class="dialog-card">
        <h3>分享对话</h3>
        <p class="dialog-desc">{{ shareSession?.title || '当前对话' }}</p>
        <div class="dialog-actions">
          <button type="button" @click="copyShareLink">复制链接</button>
          <button type="button" @click="exportShareImage">生成图片</button>
        </div>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="reportDialog.visible" class="dialog-overlay" @click.self="closeReportDialog">
      <section class="dialog-card">
        <h3>举报对话</h3>
        <p class="dialog-desc">{{ reportSession?.title || '当前对话' }}</p>

        <label class="reason-option">
          <input v-model="reportDialog.reason" type="radio" value="content_error" />
          内容错误
        </label>
        <label class="reason-option">
          <input v-model="reportDialog.reason" type="radio" value="irrelevant" />
          无关内容
        </label>

        <div class="dialog-actions">
          <button type="button" @click="submitReport">提交</button>
          <button type="button" class="ghost" @click="closeReportDialog">取消</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.session-sidebar {
  width: 280px;
  min-width: 280px;
  background: linear-gradient(180deg, #162033 0%, #0f1726 100%);
  color: #f4f8ff;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  position: relative;
}

.sidebar-header {
  padding: 20px 18px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: 0.3px;
}

.new-chat-btn {
  margin-top: 12px;
  width: 100%;
  border: 0;
  border-radius: 10px;
  background: #23a6f0;
  color: #021c2a;
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
  padding: 10px 14px;
}

.new-chat-btn:hover {
  background: #5fc4ff;
}

.session-list {
  flex: 1;
  overflow-y: auto;
}

.session-card {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
  display: flex;
  align-items: flex-start;
  justify-content:start;
  gap: 8px;
  height: 60px;
}

.session-card:hover {
  border-color: rgba(95, 196, 255, 0.65);
  background: rgba(95, 196, 255, 0.08);
}

.session-card.active {
  border-color: #23a6f0;
  background: rgba(35, 166, 240, 0.14);
}

.session-card.menu-open .session-more-btn,
.session-card:hover .session-more-btn,
.session-card:focus-within .session-more-btn {
  opacity: 1;
  pointer-events: auto;
}

.session-main {
  min-width: 0;
  flex: 1;
}

.session-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.session-main h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  word-break: break-word;
}

.rename-input {
  width: 100%;
  border: 1px solid rgba(95, 196, 255, 0.8);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.98);
  color: #18304a;
  font-size: 13px;
  padding: 4px 8px;
}

.rename-input:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(95, 196, 255, 0.25);
}

.pinned-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border-radius: 999px;
  padding: 1px 6px;
  background: rgba(255, 255, 255, 0.18);
  color: #d6ecff;
  font-size: 11px;
  line-height: 1.5;
  flex-shrink: 0;
}

.pinned-badge svg {
  width: 11px;
  height: 11px;
}

.session-main p {
  margin: 8px 0 0;
  font-size: 12px;
  color: rgba(244, 248, 255, 0.65);
}

.session-more-btn {
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.14);
  color: rgba(244, 248, 255, 0.92);
  display: grid;
  place-items: center;
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
  transition: opacity 0.2s ease, background-color 0.2s ease;
}

.session-more-btn svg {
  width: 14px;
  height: 14px;
}

.session-more-btn:hover {
  background: rgba(255, 255, 255, 0.24);
}

.action-toast {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 12px;
  margin: 0;
  padding: 9px 12px;
  border-radius: 8px;
  background: rgba(18, 34, 55, 0.88);
  color: #e9f3ff;
  font-size: 12px;
  text-align: center;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.18s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}

.history-menu {
  position: fixed;
  z-index: 2200;
  width: 120px;
  border-radius: 8px;
  border: 1px solid #e6e8eb;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.1);
  background: #ffffff;
  overflow: hidden;
}

.menu-item {
  height: 36px;
  width: 100%;
  border: 0;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  color: #333333;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}

.menu-item:hover {
  background: #f5f5f5;
}

.menu-item:active {
  background: #e8e8e8;
}

.menu-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.menu-item.danger {
  color: #f53f3f;
}

.menu-icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.menu-icon svg {
  width: 16px;
  height: 16px;
}

.delete-confirm {
  padding: 10px;
}

.delete-confirm p {
  margin: 0;
  font-size: 12px;
  color: #333333;
  line-height: 1.45;
}

.delete-actions {
  margin-top: 10px;
  display: grid;
  gap: 6px;
}

.delete-actions button {
  height: 30px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.confirm-btn {
  border: 0;
  background: #f53f3f;
  color: #fff;
}

.cancel-btn {
  border: 1px solid #d6dbe0;
  background: #fff;
  color: #333;
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 2500;
  background: rgba(13, 20, 32, 0.42);
  display: grid;
  place-items: center;
  padding: 16px;
}

.dialog-card {
  width: min(320px, 100%);
  border-radius: 12px;
  background: #fff;
  padding: 16px;
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.16);
}

.dialog-card h3 {
  margin: 0;
  font-size: 16px;
  color: #1d3551;
}

.dialog-desc {
  margin: 8px 0 14px;
  color: #506b88;
  font-size: 13px;
}

.reason-option {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #2d4a67;
}

.dialog-actions {
  margin-top: 14px;
  display: flex;
  gap: 8px;
}

.dialog-actions button {
  flex: 1;
  height: 34px;
  border: 1px solid #bed2e6;
  border-radius: 8px;
  background: #f4f8fc;
  color: #2b4f75;
  font-size: 13px;
  cursor: pointer;
}

.dialog-actions button:hover {
  background: #ebf3fb;
}

.dialog-actions .ghost {
  background: #fff;
}

@media (max-width: 920px) {
  .session-sidebar {
    width: 100%;
    min-width: 0;
    border-right: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    max-height: 280px;
  }

  .session-more-btn {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
