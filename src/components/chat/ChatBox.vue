<script setup>
import { computed, ref } from 'vue'
import VoiceRecorder from './VoiceRecorder.vue'

const props = defineProps({
  isStreaming: {
    type: Boolean,
    default: false,
  },
  streamError: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['send', 'stop', 'regenerate'])

const draft = ref('')

const canSend = computed(() => !props.isStreaming && draft.value.trim().length > 0)

function handleSend() {
  if (!canSend.value) {
    return
  }

  emit('send', draft.value)
  draft.value = ''
}

function onKeyDown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

function mergeVoiceText(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) {
    return
  }

  if (!draft.value.trim()) {
    draft.value = trimmed
    return
  }

  draft.value = `${draft.value}\n${trimmed}`
}
</script>

<template>
  <section class="chatbox-shell">
    <textarea
      v-model="draft"
      class="chatbox-input"
      :disabled="props.isStreaming"
      placeholder="Type your question..."
      rows="4"
      @keydown="onKeyDown"
    />

    <div class="chatbox-actions">
      <VoiceRecorder :disabled="props.isStreaming" @result="mergeVoiceText" />

      <button class="chatbox-btn secondary" type="button" :disabled="props.isStreaming" @click="emit('regenerate')">
        Regenerate
      </button>

      <button
        v-if="!props.isStreaming"
        class="chatbox-btn primary"
        type="button"
        :disabled="!canSend"
        @click="handleSend"
      >
        Send
      </button>

      <button v-else class="chatbox-btn danger" type="button" @click="emit('stop')">
        Stop
      </button>
    </div>

    <p class="chatbox-tip">Press Enter to send, Shift+Enter for newline.</p>
    <p v-if="props.streamError" class="chatbox-error">{{ props.streamError }}</p>
  </section>
</template>

<style scoped>
.chatbox-shell {
  padding: 16px 20px 18px;
  background: #f8fbff;
}

.chatbox-input {
  width: 100%;
  border: 1px solid #bed4ea;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 15px;
  line-height: 1.55;
  resize: vertical;
  min-height: 98px;
  color: #123354;
  background: #ffffff;
}

.chatbox-input:focus {
  outline: 2px solid rgba(35, 166, 240, 0.25);
  border-color: #5da9df;
}

.chatbox-input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.chatbox-actions {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chatbox-btn {
  border-radius: 10px;
  border: 1px solid transparent;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.chatbox-btn.primary {
  color: #f6fcff;
  background: #125f96;
}

.chatbox-btn.primary:hover:not(:disabled) {
  background: #0f4f7e;
}

.chatbox-btn.secondary {
  border-color: #b9d1e7;
  background: #f4f8fc;
  color: #294d74;
}

.chatbox-btn.secondary:hover:not(:disabled) {
  background: #e8f1f9;
}

.chatbox-btn.danger {
  color: #fff3f3;
  background: #9f2440;
}

.chatbox-btn.danger:hover {
  background: #811e35;
}

.chatbox-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.chatbox-tip {
  margin: 10px 0 0;
  color: #54789f;
  font-size: 12px;
}

.chatbox-error {
  margin: 8px 0 0;
  color: #bb1f3f;
  font-size: 12px;
  font-weight: 600;
}

@media (max-width: 920px) {
  .chatbox-shell {
    padding: 12px 14px 14px;
  }
}
</style>
