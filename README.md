# myChatApp

一个基于 `Vue 3 + Vite + Pinia + Node.js` 的类 ChatGPT 对话应用，支持流式生成、会话管理、富文本渲染与技术内容展示优化。

## 核心功能

- 类 ChatGPT 聊天界面：左侧历史会话，右侧消息流与输入区。
- 流式对话：基于 `ReadableStream + TextDecoder` 解析 SSE，逐段渲染回复。
- 中断控制：生成中可随时 `Stop` 终止。
- 历史会话管理：
  - 新建、切换、删除
  - 置顶/取消置顶
  - 重命名（空名称回退并提示）
  - 分享（复制链接 / 生成图片）
  - 举报（内容错误 / 无关内容）
- 会话持久化：`Pinia + localStorage` 自动保存与恢复上下文。
- AI 消息富文本渲染：
  - `Markdown-it` 解析 Markdown
  - `Highlight.js` 多语言代码高亮
  - `DOMPurify` 安全清洗 HTML
- 长对话性能优化：`vue-virtual-scroller` 虚拟列表渲染。
- 语音输入：浏览器 Web Speech API（可用时启用）。

## 技术栈

### 前端

- Vue 3 (Composition API)
- Vite
- Vue Router
- Pinia
- vue-virtual-scroller
- markdown-it
- highlight.js
- dompurify

### 后端

- Node.js 原生 `http/https`
- dotenv
- SSE 转发代理（MaaS 上游）

## 项目结构

```text
myChatApp/
├─ backend/
│  ├─ index.js                # 聊天代理服务（/api/chat, /health）
│  ├─ package.json
│  └─ test-stream.js
├─ src/
│  ├─ components/chat/
│  │  ├─ SessionSidebar.vue   # 会话列表与操作菜单
│  │  ├─ MessageList.vue      # 虚拟列表消息区
│  │  ├─ RichMessage.vue      # Markdown/纯文本统一渲染
│  │  ├─ ChatBox.vue          # 输入区与发送/停止/重试
│  │  └─ VoiceRecorder.vue    # 语音输入
│  ├─ stores/
│  │  └─ chat.js              # 会话状态与流式请求
│  ├─ utils/
│  │  └─ markdown.js          # Markdown + 高亮 + 安全清洗
│  ├─ views/
│  │  └─ ChatView.vue         # 主聊天页面
│  ├─ router/index.js
│  ├─ main.js
│  └─ style.css
├─ vite.config.js             # /api 代理到 3000
└─ package.json
```

## 快速开始

## 1. 安装依赖

在项目根目录：

```bash
npm install
```

安装后端依赖：

```bash
cd backend
npm install
cd ..
```

## 2. 配置环境变量

在 `backend/` 下创建 `.env`：

```env
API_KEY=your_api_key
PORT=3000

# 可选项（有默认值）
MODEL_ID=xopdeepseekv32
MAAS_HOST=maas-api.cn-huabei-1.xf-yun.com
MAAS_PATH=/v1/chat/completions
```

## 3. 启动服务

启动后端（终端 1）：

```bash
cd backend
npm run dev
```

启动前端（终端 2）：

```bash
npm run dev
```

默认访问：`http://localhost:5173`

## 脚本说明

根目录：

- `npm run dev`：启动前端开发环境
- `npm run build`：构建前端产物
- `npm run preview`：本地预览构建产物

`backend/` 目录：

- `npm run dev`：启动后端服务
- `npm start`：生产模式启动后端

## API 说明

### `POST /api/chat`

请求体（示例）：

```json
{
  "messages": [
    { "role": "user", "content": "你好" }
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 4000
}
```

说明：

- `stream` 默认开启（不传时按流式处理）。
- 服务端会将上游流式响应按 SSE 返回前端。

### `GET /health`

健康检查接口。

## 开发备注

- 会话本地缓存键：`mychatapp.sessions.v1`。
- 前端通过 Vite 代理调用后端：`/api`、`/health` -> `http://localhost:3000`。
- 分享链接当前为前端本地会话标识方案（跨设备分享需后端持久化能力）。

## 常见问题

1. `Missing API_KEY environment variable`
   - 检查 `backend/.env` 是否存在且包含 `API_KEY`。

2. 前端发送后无流式回复
   - 确认后端已启动在 `3000` 端口。
   - 检查浏览器 Network 中 `/api/chat` 响应是否为 SSE。

3. 历史会话异常
   - 清理浏览器 `localStorage` 中的 `mychatapp.sessions.v1` 后重试。

