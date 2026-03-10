<script setup>
import { computed } from 'vue'
import { renderMarkdown, renderPlainText } from '../../utils/markdown'

const props = defineProps({
  content: {
    type: String,
    default: '',
  },
  mode: {
    type: String,
    default: 'plain',
    validator(value) {
      return value === 'markdown' || value === 'plain'
    },
  },
})

const html = computed(() => {
  // AI 消息按 Markdown 渲染，用户消息按纯文本渲染。
  if (props.mode === 'markdown') {
    return renderMarkdown(props.content)
  }

  return renderPlainText(props.content)
})
</script>

<template>
  <div class="rich-message" v-html="html" />
</template>

<style scoped>
.rich-message {
  font-size: 15px;
  line-height: 1.65;
  color: inherit;
  word-break: break-word;
}

.rich-message :deep(p) {
  margin: 0;
}

.rich-message :deep(p + p) {
  margin-top: 0.72em;
}

.rich-message :deep(h1),
.rich-message :deep(h2),
.rich-message :deep(h3),
.rich-message :deep(h4) {
  margin: 0.75em 0 0.4em;
  line-height: 1.3;
}

.rich-message :deep(ul),
.rich-message :deep(ol) {
  margin: 0.5em 0 0.6em;
  padding-left: 1.4em;
}

.rich-message :deep(li + li) {
  margin-top: 0.28em;
}

.rich-message :deep(blockquote) {
  margin: 0.7em 0;
  padding: 0.5em 0.9em;
  border-left: 3px solid #9ab7d4;
  background: rgba(153, 184, 214, 0.1);
  border-radius: 6px;
}

.rich-message :deep(code) {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 0.9em;
}

.rich-message :deep(pre) {
  margin: 0.7em 0;
  overflow-x: auto;
  border-radius: 10px;
}

.rich-message :deep(pre code) {
  display: block;
  padding: 0.9em 1em;
}

.rich-message :deep(:not(pre) > code) {
  background: rgba(17, 49, 84, 0.08);
  border: 1px solid rgba(17, 49, 84, 0.12);
  border-radius: 6px;
  padding: 0.1em 0.35em;
}

.rich-message :deep(a) {
  color: #0c5f9d;
  text-decoration: none;
  border-bottom: 1px solid rgba(12, 95, 157, 0.35);
}

.rich-message :deep(a:hover) {
  border-bottom-color: rgba(12, 95, 157, 0.75);
}

.rich-message :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.7em 0;
}

.rich-message :deep(th),
.rich-message :deep(td) {
  border: 1px solid #d4e1ee;
  padding: 0.45em 0.6em;
  text-align: left;
}

.rich-message :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}
</style>
