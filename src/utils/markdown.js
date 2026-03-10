import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/common'
import DOMPurify from 'dompurify'

// 兜底转义：用于未知语言代码块，避免直接插入原始 HTML。
function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

// 统一 Markdown 渲染器：禁用原始 HTML，代码块使用 highlight.js。
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(code, language) {
    const hasLanguage = language && hljs.getLanguage(language)

    if (hasLanguage) {
      const highlighted = hljs.highlight(code, {
        language,
        ignoreIllegals: true,
      }).value

      return `<pre class="hljs-block"><code class="hljs language-${language}">${highlighted}</code></pre>`
    }

    return `<pre class="hljs-block"><code class="hljs">${escapeHtml(code)}</code></pre>`
  },
})

const defaultLinkOpen = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const targetIndex = token.attrIndex('target')
  if (targetIndex < 0) {
    token.attrPush(['target', '_blank'])
  } else {
    token.attrs[targetIndex][1] = '_blank'
  }

  const relIndex = token.attrIndex('rel')
  if (relIndex < 0) {
    token.attrPush(['rel', 'noopener noreferrer nofollow'])
  } else {
    token.attrs[relIndex][1] = 'noopener noreferrer nofollow'
  }

  return defaultLinkOpen(tokens, idx, options, env, self)
}

// 二次清洗，防止渲染结果中出现潜在危险标签/属性。
const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target', 'rel', 'class'],
}

export function renderMarkdown(content = '') {
  const rawHtml = md.render(String(content || ''))
  return DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG)
}

export function renderPlainText(content = '') {
  const escaped = escapeHtml(String(content || ''))
  return escaped.replace(/\n/g, '<br>')
}
