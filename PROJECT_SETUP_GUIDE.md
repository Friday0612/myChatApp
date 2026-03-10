# Vue AI 聊天项目 - 完整复现指南

本指南将带你从零开始搭建一个基于 Vue 3 + Node.js 的 AI 聊天应用。

## 项目概述

- 前端：Vue 3 + Element Plus + Pinia + Vue Router
- 后端：Node.js + 原生 HTTP 模块
- AI 服务：讯飞 MaaS 平台

## 第一步：创建 Vue 项目

```bash
# 使用 Vite 创建 Vue 3 项目
npm create vite@latest yuan-chat-vue -- --template vue

# 进入项目目录
cd yuan-chat-vue

# 安装依赖
npm install
```

## 第二步：安装前端依赖

```bash
# 安装 Element Plus UI 组件库
npm install element-plus

# 安装 Vue Router 路由管理
npm install vue-router

# 安装 Pinia 状态管理
npm install pinia
```

## 第三步：配置前端基础结构

### 3.1 配置 main.js

创建 `src/main.js`：

```javascript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)
app.mount('#app')
```

### 3.2 创建路由配置

创建 `src/router/index.js`：

```javascript
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AIView from '../views/AIView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/ai',
      name: 'ai',
      component: AIView
    }
  ]
})

export default router
```

### 3.3 更新 App.vue

创建 `src/App.vue`：

```vue
<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div id="app">
    <nav>
      <RouterLink to="/">首页</RouterLink>
      <RouterLink to="/ai">AI 聊天</RouterLink>
    </nav>
    <main>
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

nav {
  padding: 20px;
  background-color: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  gap: 20px;
}

nav a {
  text-decoration: none;
  color: #333;
  font-weight: 500;
}

nav a.router-link-active {
  color: #0284c7;
}

main {
  flex: 1;
  overflow: hidden;
}
</style>
```

## 第四步：创建 AI 聊天页面

创建 `src/views/AIView.vue`：

```vue
<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { ChatDotRound, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const messages = ref([
  {
    id: 1,
    role: 'assistant',
    content: '你好！我是你的AI助手，有什么可以帮助你的吗？',
    timestamp: new Date().toLocaleString()
  }
])

const inputMessage = ref('')
const chatContainer = ref(null)
const isGenerating = ref(false)

const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

const sendMessage = async () => {
  if (!inputMessage.value.trim() || isGenerating.value) {
    return
  }

  const userMessage = {
    id: Date.now(),
    role: 'user',
    content: inputMessage.value.trim(),
    timestamp: new Date().toLocaleString()
  }
  messages.value.push(userMessage)
  inputMessage.value = ''
  isGenerating.value = true

  try {
    const apiMessages = messages.value.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: apiMessages
      })
    })

    if (!response.ok) {
      throw new Error('API请求失败')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let aiReply = {
      id: Date.now() + 1,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleString()
    }
    messages.value.push(aiReply)
    isGenerating.value = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') break

          try {
            const json = JSON.parse(data)
            if (json.error) {
              throw new Error(json.error)
            }
            if (json.choices && json.choices.length > 0) {
              const delta = json.choices[0].delta
              const content = delta?.content || ''
              if (content) {
                aiReply.content += content
                messages.value = [...messages.value]
                scrollToBottom()
              }
            }
          } catch (jsonError) {
            console.error('解析JSON错误:', jsonError)
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', error)
    ElMessage.error('获取AI回复失败，请稍后重试')
  } finally {
    isGenerating.value = false
    scrollToBottom()
  }
}

onMounted(() => {
  scrollToBottom()
})
</script>

<template>
  <div class="chat-container">
    <div class="chat-messages" ref="chatContainer">
      <div
        v-for="(message, index) in messages"
        :key="index"
        :class="[
          'message-item',
          message.role === 'assistant' ? 'ai-message' : 'user-message'
        ]"
      >
        <div class="message-content">{{ message.content }}</div>
      </div>

      <div v-if="isGenerating" class="message-item ai-message">
        <div class="message-content generating">
          <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
          <span class="typing-text">正在思考...</span>
        </div>
      </div>
    </div>

    <div class="input-area">
      <el-input
        v-model="inputMessage"
        placeholder="请输入消息..."
        @keyup.enter="sendMessage"
        :disabled="isGenerating"
        type="textarea"
        :rows="3"
        resize="none"
      />
      <el-button
        type="primary"
        @click="sendMessage"
        :disabled="isGenerating || !inputMessage.trim()"
        :icon="isGenerating ? Refresh : ChatDotRound"
        :loading="isGenerating"
      >
        {{ isGenerating ? '生成中...' : '发送' }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f5f5f5;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: #fafafa;
}

.message-item {
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.generating {
  display: flex;
  align-items: center;
  gap: 12px;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding-top: 2px;
}

.typing-dot {
  width: 8px;
  height: 8px;
  background-color: #0284c7;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

.typing-text {
  color: #666;
  font-style: italic;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}

.ai-message {
  justify-content: flex-start;
}

.user-message {
  justify-content: flex-end;
}

.message-content {
  max-width: 70%;
  padding: 14px 18px;
  border-radius: 18px;
  font-size: 15px;
  line-height: 1.5;
  word-wrap: break-word;
}

.ai-message .message-content {
  background-color: #fff;
  border: 1px solid #e8e8e8;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.user-message .message-content {
  background-color: #0284c7;
  color: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.input-area {
  padding: 20px;
  background-color: #fff;
  border-top: 1px solid #e8e8e8;
}

.input-area :deep(.el-textarea__inner) {
  border-radius: 12px;
  border-color: #e8e8e8;
  resize: none;
  font-size: 15px;
}

.input-area :deep(.el-button) {
  margin-top: 12px;
  border-radius: 12px;
  padding: 8px 24px;
  font-size: 15px;
  background-color: #0284c7;
  border: none;
}

.input-area :deep(.el-button:hover) {
  background-color: #0ea5e9;
}

.input-area :deep(.el-button.is-disabled) {
  background-color: #93c5fd;
  cursor: not-allowed;
}
</style>
```

## 第五步：创建后端服务

### 5.1 初始化后端项目

```bash
# 在项目根目录创建 backend 文件夹
mkdir backend
cd backend

# 初始化 npm 项目
npm init -y
```

### 5.2 安装后端依赖

```bash
npm install dotenv
```

### 5.3 创建后端服务器

创建 `backend/index.js`：

```javascript
const http = require('http');
const https = require('https');
const dotenv = require('dotenv');

dotenv.config();

const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const requestData = JSON.parse(body);
        const { messages } = requestData;

        console.log('=== 收到请求 ===');
        console.log('消息:', messages);

        handleStreamRequest(messages, res);
      } catch (error) {
        console.error('解析请求体错误:', error);
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: '请求格式错误' }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', message: 'AI Chat API is running' }));
  } else {
    res.statusCode = 404;
    res.end();
  }
});

function handleStreamRequest(messages, res) {
  const requestBody = {
    model: 'xopdeepseekv32',
    messages: messages,
    max_tokens: 4000,
    temperature: 0.7,
    stream: true
  };

  const options = {
    hostname: 'maas-api.cn-huabei-1.xf-yun.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'User-Agent': 'Node.js-Client',
      'Accept': '*/*'
    }
  };

  console.log('发送到MaaS的请求体:', JSON.stringify(requestBody, null, 2));

  const maasReq = https.request(options, (maasRes) => {
    console.log('\n=== MaaS API 响应 ===');
    console.log('状态码:', maasRes.statusCode);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    maasRes.pipe(res);

    maasRes.on('end', () => {
      console.log('\n=== 响应结束 ===');
    });
  });

  maasReq.on('error', (error) => {
    console.error('\n=== 请求错误 ===');
    console.error('错误:', error);

    res.write(`data: {"error": "流式请求失败：${error.message}"} \n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });

  maasReq.on('timeout', () => {
    console.error('\n=== 请求超时 ===');
    maasReq.destroy();

    res.write(`data: {"error": "请求超时"} \n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });

  maasReq.write(JSON.stringify(requestBody));
  maasReq.end();

  console.log('\n=== 请求已发送 ===');
}

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
```

### 5.4 配置 package.json

编辑 `backend/package.json`，添加启动脚本：

```json
{
  "name": "backend",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  "dependencies": {
    "dotenv": "^17.2.3"
  }
}
```

### 5.5 创建环境变量文件

创建 `backend/.env`：

```env
# 服务器端口
PORT=3000

# 讯飞MaaS平台API密钥
API_KEY=your_api_key_here
```

## 第六步：获取讯飞 MaaS API 密钥

1. 访问 [讯飞 MaaS 平台](https://maas.xfyun.cn/)
2. 注册并登录账号
3. 创建服务，选择合适的模型（如 xopdeepseekv32）
4. 在服务详情页面找到 HTTP 协议的 APIKey
5. 将 APIKey 复制到 `backend/.env` 文件中

## 第七步：启动项目

### 7.1 启动后端服务

```bash
cd backend
npm run dev
```

后端服务将在 `http://localhost:3000` 启动

### 7.2 启动前端开发服务器

在新的终端窗口中：

```bash
# 回到项目根目录
cd ..

# 启动前端
npm run dev
```

前端服务将在 `http://localhost:5173` 启动

## 第八步：测试应用

1. 打开浏览器访问 `http://localhost:5173`
2. 点击导航栏的 "AI 聊天"
3. 在输入框中输入消息并发送
4. 查看 AI 的流式回复

## 常见问题排查

### 问题 1：API 返回 403 错误

**原因**：模型名称不正确或 API Key 没有权限

**解决方案**：
- 检查 `backend/index.js` 中的 `model` 字段
- 确认你的 API Key 有权限使用该模型
- 在讯飞 MaaS 平台查看可用的模型列表

### 问题 2：前端无法连接后端

**原因**：后端服务未启动或端口被占用

**解决方案**：
- 确认后端服务正在运行
- 检查端口 3000 是否被占用
- 查看浏览器控制台的网络请求

### 问题 3：环境变量未生效

**原因**：环境变量名称不匹配

**解决方案**：
- 确认 `.env` 文件中的变量名与代码中的一致
- 修改后需要重启后端服务

## 项目结构

```
yuan-chat-vue/
├── backend/
│   ├── .env                 # 环境变量配置
│   ├── index.js            # 后端服务器
│   └── package.json        # 后端依赖配置
├── src/
│   ├── views/
│   │   └── AIView.vue      # AI 聊天页面
│   ├── router/
│   │   └── index.js        # 路由配置
│   ├── App.vue             # 根组件
│   └── main.js             # 入口文件
├── package.json            # 前端依赖配置
└── vite.config.js          # Vite 配置
```

## 下一步优化建议

1. 添加消息历史记录持久化
2. 实现多会话管理
3. 添加代码高亮显示
4. 支持 Markdown 渲染
5. 添加用户认证功能
6. 实现消息导出功能

## 总结

恭喜！你已经成功搭建了一个完整的 Vue AI 聊天应用。这个项目展示了：

- Vue 3 组合式 API 的使用
- 流式 API 响应处理
- 前后端分离架构
- 实时数据更新
- 现代化的 UI 设计

继续探索和改进你的应用吧！
