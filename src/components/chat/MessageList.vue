<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import RichMessage from './RichMessage.vue'

const props = defineProps({
  messages: {
    type: Array,
    default: () => [],
  },
  isStreaming: {
    type: Boolean,
    default: false,
  },
})

const scrollerRef = ref(null)
const stickToBottom = ref(true)

const virtualMessages = computed(() =>
  props.messages.map((message, index) => ({
    ...message,
    id: message.id || `msg_virtual_${index}`,
  })),
)

function formatRole(role) {
  return role === 'assistant' ? 'Assistant' : 'You'
}

function messageText(message) {
  return (message?.content || '').trimEnd()
}

function messageRenderMode(message) {
  return message?.role === 'assistant' ? 'markdown' : 'plain'
}

function onScroll(event) {
  const target = event.target
  if (!target) {
    return
  }

  const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight
  stickToBottom.value = distanceToBottom < 96
}

async function scrollToLatest(force = false) {
  await nextTick()

  if (!force && !stickToBottom.value) {
    return
  }

  if (!virtualMessages.value.length) {
    return
  }

  scrollerRef.value?.scrollToItem(virtualMessages.value.length - 1)
}

watch(
  () => props.messages.length,
  async () => {
    await scrollToLatest()
  },
)

watch(
  () => props.isStreaming,
  async (streamingNow, streamingPrev) => {
    if (streamingPrev && !streamingNow) {
      await scrollToLatest(true)
    }
  },
)

onMounted(async () => {
  await scrollToLatest(true)
})
</script>

<template>
  <section class="message-shell">
    <DynamicScroller
      v-if="virtualMessages.length"
      ref="scrollerRef"
      class="message-scroller"
      :items="virtualMessages"
      :min-item-size="84"
      key-field="id"
      @scroll.passive="onScroll"
    >
      <template #default="{ item, active }">
        <DynamicScrollerItem
          :item="item"
          :active="active"
          :size-dependencies="[item.content]"
          class="message-item-wrap"
        >
          <article class="message-item" :class="`role-${item.role}`">
            <header class="message-role">{{ formatRole(item.role) }}</header>
            <RichMessage class="message-content" :content="messageText(item)" :mode="messageRenderMode(item)" />
            <span v-if="item.status === 'streaming'" class="stream-cursor" />
          </article>
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>

    <div v-else class="empty-hint">
      <h3>Start a conversation</h3>
      <p>Ask a question to begin a new streaming chat.</p>
    </div>
  </section>
</template>

<style scoped>
.message-shell {
  flex: 1;
  min-height: 0;
  border-top: 1px solid rgba(13, 26, 46, 0.08);
  border-bottom: 1px solid rgba(13, 26, 46, 0.08);
  background: linear-gradient(180deg, #fcfdff 0%, #f4f8ff 100%);
}

.message-scroller {
  height: 100%;
  padding: 22px 0;
}

.message-item-wrap {
  padding: 0 26px;
}

.message-item {
  max-width: min(920px, 100%);
  margin: 0 auto 14px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid transparent;
}

.role-assistant {
  background: #ffffff;
  border-color: #dce7f4;
}

.role-user {
  background: #10345b;
  border-color: #1c4f80;
}

.role-user .message-role,
.role-user .message-content {
  color: #f6fbff;
}

.message-role {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #40648a;
}

.message-content {
  margin: 8px 0 0;
  font-family: inherit;
  color: #10253f;
}

.stream-cursor {
  display: inline-block;
  width: 9px;
  height: 17px;
  margin-left: 6px;
  vertical-align: middle;
  background: #0e3f6d;
  animation: cursor-blink 1s steps(1) infinite;
}

@keyframes cursor-blink {
  50% {
    opacity: 0;
  }
}

.empty-hint {
  height: 100%;
  display: grid;
  place-items: center;
  text-align: center;
  color: #375778;
}

.empty-hint h3 {
  margin: 0;
  font-size: 24px;
}

.empty-hint p {
  margin: 8px 0 0;
  font-size: 14px;
}

@media (max-width: 920px) {
  .message-item-wrap {
    padding: 0 14px;
  }

  .message-item {
    margin-bottom: 12px;
    border-radius: 12px;
  }
}
</style>
