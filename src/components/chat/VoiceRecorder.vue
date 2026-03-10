<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['result'])

const supported = ref(false)
const recording = ref(false)

let recognition = null
let transcriptCache = []

const buttonLabel = computed(() => {
  if (!supported.value) {
    return 'Voice unavailable'
  }
  return recording.value ? 'Stop voice' : 'Voice input'
})

function setupRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

  if (!SpeechRecognition) {
    supported.value = false
    return
  }

  supported.value = true
  recognition = new SpeechRecognition()
  recognition.continuous = false
  recognition.interimResults = true
  recognition.lang = 'zh-CN'

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i]
      if (result.isFinal) {
        transcriptCache.push(result[0].transcript)
      }
    }
  }

  recognition.onerror = () => {
    recording.value = false
  }

  recognition.onend = () => {
    recording.value = false

    const merged = transcriptCache.join(' ').replace(/\s+/g, ' ').trim()
    transcriptCache = []

    if (merged) {
      emit('result', merged)
    }
  }
}

function toggleRecord() {
  if (!supported.value || props.disabled || !recognition) {
    return
  }

  if (recording.value) {
    recognition.stop()
    recording.value = false
    return
  }

  transcriptCache = []
  recording.value = true
  recognition.start()
}

onMounted(() => {
  setupRecognition()
})

onBeforeUnmount(() => {
  if (recognition && recording.value) {
    recognition.stop()
  }
})
</script>

<template>
  <button class="voice-btn" type="button" :disabled="!supported || props.disabled" @click="toggleRecord">
    {{ buttonLabel }}
  </button>
</template>

<style scoped>
.voice-btn {
  border: 1px solid #c3d7ec;
  border-radius: 10px;
  background: #f2f8ff;
  color: #0f3d67;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 12px;
  cursor: pointer;
}

.voice-btn:hover:not(:disabled) {
  border-color: #8ab6e3;
  background: #e2f0ff;
}

.voice-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
