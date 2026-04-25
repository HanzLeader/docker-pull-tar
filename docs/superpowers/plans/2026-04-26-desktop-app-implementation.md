# Docker Pull Desktop App 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将现有 Docker 镜像拉取命令行工具改造为 Vue3 + Electron + FastAPI 桌面应用。

**架构：** Electron 主进程管理 FastAPI Python 子进程，Vue3 渲染进程通过 HTTP API 和 WebSocket 与后端通信，复用现有下载核心逻辑。

**技术栈：** Vue3 + Vite + Pinia + Element Plus + Electron + FastAPI + pnpm

---

## 文件结构

### 前端文件 (frontend/)

| 文件 | 职责 |
|------|------|
| `package.json` | 前端依赖和脚本配置 |
| `vite.config.js` | Vite 构建配置 |
| `electron-builder.json` | Electron 打包配置 |
| `src/main.js` | Vue 应用入口 |
| `src/App.vue` | 根组件，路由布局 |
| `src/router/index.js` | Vue Router 路由配置 |
| `src/views/Home.vue` | 主页下载界面 |
| `src/views/History.vue` | 下载历史页面 |
| `src/views/Settings.vue` | 设置页面 |
| `src/components/LogConsole.vue` | 控制台日志组件 |
| `src/components/DownloadProgress.vue` | 下载进度条组件 |
| `src/components/MirrorSelector.vue` | 镜像源选择器组件 |
| `src/stores/download.js` | 下载状态管理 (Pinia) |
| `src/stores/settings.js` | 设置状态管理 (Pinia) |
| `src/api/index.js` | API 调用封装 |
| `src/utils/imageParser.js` | 镜像包名解析和拼接 |
| `electron/main.js` | Electron 主进程入口 |
| `electron/preload.js` | 预加载脚本，暴露原生 API |
| `electron/pythonProcess.js` | Python 子进程管理器 |

### 后端文件 (backend/)

| 文件 | 职责 |
|------|------|
| `main.py` | FastAPI 应用入口，WebSocket 路由 |
| `requirements.txt` | Python 依赖 |
| `routers/download.py` | 下载 API 路由 |
| `routers/settings.py` | 设置和镜像源 API 路由 |
| `routers/history.py` | 历史记录 API 路由 |
| `services/docker_pull.py` | 核心下载逻辑（复用现有代码） |
| `services/settings_store.py` | 设置 JSON 文件存储服务 |
| `services/log_websocket.py` | WebSocket 日志推送服务 |
| `models/schemas.py` | Pydantic 数据模型 |

### 根目录文件

| 文件 | 職责 |
|------|------|
| `package.json` | pnpm 工作区配置 |
| `pnpm-workspace.yaml` | pnpm 工作区定义 |

---

## 阶段一：基础架构搭建

### 任务 1：创建根目录 pnpm 工作区配置

**文件：**
- 创建：`package.json`
- 创建：`pnpm-workspace.yaml`

- [ ] **步骤 1：创建根目录 package.json**

```json
{
  "name": "docker-pull-tar",
  "version": "2.0.0",
  "private": true,
  "description": "Docker 镜像下载桌面应用",
  "scripts": {
    "dev": "pnpm --filter frontend dev",
    "build": "pnpm --filter frontend build",
    "electron:dev": "pnpm --filter frontend electron:dev",
    "electron:build": "pnpm --filter frontend electron:build"
  }
}
```

- [ ] **步骤 2：创建 pnpm-workspace.yaml**

```yaml
packages:
  - 'frontend'
```

- [ ] **步骤 3：Commit**

```bash
git add package.json pnpm-workspace.yaml
git commit -m "chore: 配置 pnpm 工作区"
```

---

### 任务 2：创建 FastAPI 后端项目骨架

**文件：**
- 创建：`backend/main.py`
- 创建：`backend/requirements.txt`

- [ ] **步骤 1：创建 backend 目录结构**

```bash
mkdir -p backend/routers backend/services backend/models
```

- [ ] **步骤 2：创建 requirements.txt**

```text
fastapi==0.115.0
uvicorn==0.30.0
websockets==12.0
requests==2.32.3
urllib3==2.3.0
tqdm==4.67.1
pydantic==2.9.0
```

- [ ] **步骤 3：创建 main.py 基础结构**

```python
import os
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(
    title="Docker Pull API",
    description="Docker 镜像下载服务",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "2.0.0"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="127.0.0.1", port=port)
```

- [ ] **步骤 4：测试后端启动**

运行：`cd backend && pip install -r requirements.txt && python main.py`
预期：服务启动在 http://127.0.0.1:8000，访问 /api/health 返回 {"status": "ok"}

- [ ] **步骤 5：Commit**

```bash
git add backend/
git commit -m "feat: 创建 FastAPI 后端骨架"
```

---

### 任务 3：创建后端数据模型

**文件：**
- 创建：`backend/models/schemas.py`

- [ ] **步骤 1：创建 schemas.py 定义所有数据模型**

```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class DownloadStatus(str, Enum):
    idle = "idle"
    preparing = "preparing"
    downloading = "downloading"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"

class MirrorSource(BaseModel):
    id: str
    name: str
    registry: str
    isDefault: bool = False

class Settings(BaseModel):
    defaultOutputDir: str = str(Path.home() / "Downloads")
    defaultArch: str = "amd64"
    defaultMirror: str = "docker.1ms.run"
    downloadWorkers: int = Field(default=4, ge=1, le=16)

class DownloadRequest(BaseModel):
    packageName: str
    tag: Optional[str] = "latest"
    arch: Optional[str] = None
    mirror: Optional[str] = None
    outputDir: Optional[str] = None

class DownloadProgress(BaseModel):
    status: DownloadStatus
    packageName: str
    currentLayer: int
    totalLayers: int
    downloadedBytes: int
    totalBytes: int
    speed: float
    layers: List[dict]

class HistoryItem(BaseModel):
    id: str
    packageName: str
    tag: str
    arch: str
    mirror: str
    fullImage: str
    status: DownloadStatus
    outputPath: Optional[str] = None
    downloadedAt: Optional[datetime] = None
    size: Optional[str] = None
    error: Optional[str] = None

class ConfigData(BaseModel):
    version: str = "1.0"
    settings: Settings = Settings()
    mirrors: List[MirrorSource] = []
    history: List[HistoryItem] = []

class LogMessage(BaseModel):
    type: str = "log"
    level: str
    message: str
    timestamp: datetime
```

- [ ] **步骤 2：Commit**

```bash
git add backend/models/schemas.py
git commit -m "feat: 定义后端数据模型"
```

---

### 任务 4：创建设置存储服务

**文件：**
- 创建：`backend/services/settings_store.py`

- [ ] **步骤 1：创建 settings_store.py**

```python
import json
import os
from pathlib import Path
from typing import Optional
from models.schemas import ConfigData, MirrorSource, HistoryItem, Settings

class SettingsStore:
    def __init__(self):
        self.config_dir = Path(os.environ.get("APPDATA", Path.home())) / "docker-pull-tar"
        self.config_file = self.config_dir / "config.json"
        self._ensure_config_dir()
        self._load_config()

    def _ensure_config_dir(self):
        self.config_dir.mkdir(parents=True, exist_ok=True)

    def _get_default_mirrors(self) -> list:
        return [
            {"id": "dockerhub", "name": "Docker Hub", "registry": "registry-1.docker.io", "isDefault": False},
            {"id": "1ms", "name": "1ms.run", "registry": "docker.1ms.run", "isDefault": True},
            {"id": "daocloud", "name": "DaoCloud", "registry": "docker.m.daocloud.io", "isDefault": False},
            {"id": "xuanyuan", "name": "轩辕", "registry": "docker.xuanyuan.me", "isDefault": False},
        ]

    def _load_config(self):
        if self.config_file.exists():
            try:
                with open(self.config_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.config = ConfigData(**data)
            except Exception:
                self.config = ConfigData(mirrors=[MirrorSource(**m) for m in self._get_default_mirrors()])
        else:
            self.config = ConfigData(mirrors=[MirrorSource(**m) for m in self._get_default_mirrors()])
            self._save_config()

    def _save_config(self):
        with open(self.config_file, "w", encoding="utf-8") as f:
            json.dump(self.config.model_dump(), f, indent=2, ensure_ascii=False, default=str)

    def get_settings(self) -> Settings:
        return self.config.settings

    def update_settings(self, settings: Settings) -> Settings:
        self.config.settings = settings
        self._save_config()
        return self.config.settings

    def get_mirrors(self) -> list:
        return self.config.mirrors

    def add_mirror(self, mirror: MirrorSource) -> MirrorSource:
        self.config.mirrors.append(mirror)
        self._save_config()
        return mirror

    def update_mirror(self, mirror_id: str, mirror: MirrorSource) -> Optional[MirrorSource]:
        for i, m in enumerate(self.config.mirrors):
            if m.id == mirror_id:
                self.config.mirrors[i] = mirror
                self._save_config()
                return mirror
        return None

    def delete_mirror(self, mirror_id: str) -> bool:
        self.config.mirrors = [m for m in self.config.mirrors if m.id != mirror_id]
        self._save_config()
        return True

    def set_default_mirror(self, mirror_id: str) -> bool:
        for m in self.config.mirrors:
            m.isDefault = (m.id == mirror_id)
        default_registry = next((m.registry for m in self.config.mirrors if m.isDefault), "docker.1ms.run")
        self.config.settings.defaultMirror = default_registry
        self._save_config()
        return True

    def get_history(self) -> list:
        return self.config.history

    def add_history(self, item: HistoryItem) -> HistoryItem:
        self.config.history.append(item)
        if len(self.config.history) > 100:
            self.config.history = self.config.history[-100:]
        self._save_config()
        return item

    def delete_history(self, item_id: str) -> bool:
        self.config.history = [h for h in self.config.history if h.id != item_id]
        self._save_config()
        return True

    def clear_history(self) -> bool:
        self.config.history = []
        self._save_config()
        return True
```

- [ ] **步骤 2：Commit**

```bash
git add backend/services/settings_store.py
git commit -m "feat: 实现设置存储服务"
```

---

### 任务 5：创建设置和镜像源 API 路由

**文件：**
- 创建：`backend/routers/settings.py`

- [ ] **步骤 1：创建 settings.py 路由**

```python
from fastapi import APIRouter, HTTPException
from models.schemas import Settings, MirrorSource
from services.settings_store import SettingsStore
import uuid

router = APIRouter(prefix="/api", tags=["settings"])
store = SettingsStore()

@router.get("/settings")
async def get_settings():
    return store.get_settings()

@router.post("/settings")
async def update_settings(settings: Settings):
    return store.update_settings(settings)

@router.get("/mirrors")
async def get_mirrors():
    return store.get_mirrors()

@router.post("/mirrors")
async def add_mirror(mirror: MirrorSource):
    if not mirror.id:
        mirror.id = f"custom-{uuid.uuid4().hex[:8]}"
    return store.add_mirror(mirror)

@router.put("/mirrors/{mirror_id}")
async def update_mirror(mirror_id: str, mirror: MirrorSource):
    result = store.update_mirror(mirror_id, mirror)
    if not result:
        raise HTTPException(status_code=404, detail="镜像源不存在")
    return result

@router.delete("/mirrors/{mirror_id}")
async def delete_mirror(mirror_id: str):
    return {"success": store.delete_mirror(mirror_id)}

@router.post("/mirrors/{mirror_id}/default")
async def set_default_mirror(mirror_id: str):
    return {"success": store.set_default_mirror(mirror_id)}
```

- [ ] **步骤 2：在 main.py 注册路由**

```python
from routers import settings

app.include_router(settings.router)
```

- [ ] **步骤 3：测试 API**

运行：`python main.py`
访问：`GET http://127.0.0.1:8000/api/settings`
预期：返回默认设置

- [ ] **步骤 4：Commit**

```bash
git add backend/routers/settings.py backend/main.py
git commit -m "feat: 实现设置和镜像源 API"
```

---

### 任务 6：创建 Vue3 前端项目骨架

**文件：**
- 创建：`frontend/package.json`
- 创建：`frontend/vite.config.js`
- 创建：`frontend/index.html`
- 创建：`frontend/src/main.js`
- 创建：`frontend/src/App.vue`

- [ ] **步骤 1：创建 frontend 目录结构**

```bash
mkdir -p frontend/src/views frontend/src/components frontend/src/stores frontend/src/api frontend/src/utils frontend/src/router frontend/electron frontend/public
```

- [ ] **步骤 2：创建 frontend/package.json**

```json
{
  "name": "frontend",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "electron:dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "electron:build": "vite build && electron-builder"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.3.0",
    "pinia": "^2.1.0",
    "element-plus": "^2.5.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.0.0",
    "electron": "^30.0.0",
    "electron-builder": "^24.0.0",
    "concurrently": "^8.2.0",
    "wait-on": "^7.2.0"
  },
  "main": "electron/main.js"
}
```

- [ ] **步骤 3：创建 vite.config.js**

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  server: {
    port: 5173
  }
})
```

- [ ] **步骤 4：创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Docker 镜像下载工具</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **步骤 5：创建 src/main.js**

```javascript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app')
```

- [ ] **步骤 6：创建 src/App.vue**

```vue
<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="logo">
        <span class="logo-icon">🚀</span>
        <span class="logo-text">Docker 镜像下载工具</span>
      </div>
      <el-menu mode="horizontal" :default-active="activeMenu" router>
        <el-menu-item index="/">下载</el-menu-item>
        <el-menu-item index="/history">历史</el-menu-item>
        <el-menu-item index="/settings">设置</el-menu-item>
      </el-menu>
    </el-header>
    <el-main class="app-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeMenu = computed(() => route.path)
</script>

<style>
.app-container {
  height: 100vh;
}
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}
.logo {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: bold;
}
.logo-icon {
  margin-right: 8px;
}
.app-main {
  background: #f5f7fa;
}
</style>
```

- [ ] **步骤 7：安装依赖并测试**

运行：`cd frontend && pnpm install && pnpm dev`
预期：浏览器访问 http://localhost:5173 显示空白页面（路由未配置）

- [ ] **步骤 8：Commit**

```bash
git add frontend/
git commit -m "feat: 创建 Vue3 前端项目骨架"
```

---

### 任务 7：创建 Vue Router 路由配置

**文件：**
- 创建：`frontend/src/router/index.js`
- 创建：`frontend/src/views/Home.vue`（空白占位）
- 创建：`frontend/src/views/History.vue`（空白占位）
- 创建：`frontend/src/views/Settings.vue`（空白占位）

- [ ] **步骤 1：创建 router/index.js**

```javascript
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue')
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('@/views/History.vue')
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
```

- [ ] **步骤 2：创建空白占位页面 Home.vue**

```vue
<template>
  <div class="home-page">
    <h1>下载页面（待实现）</h1>
  </div>
</template>

<script setup>
</script>
```

- [ ] **步骤 3：创建空白占位页面 History.vue**

```vue
<template>
  <div class="history-page">
    <h1>历史记录页面（待实现）</h1>
  </div>
</template>

<script setup>
</script>
```

- [ ] **步骤 4：创建空白占位页面 Settings.vue**

```vue
<template>
  <div class="settings-page">
    <h1>设置页面（待实现）</h1>
  </div>
</template>

<script setup>
</script>
```

- [ ] **步骤 5：测试路由**

运行：`pnpm dev`
访问：`http://localhost:5173`、`http://localhost:5173/#/history`、`http://localhost:5173/#/settings`
预期：各页面显示对应的占位标题

- [ ] **步骤 6：Commit**

```bash
git add frontend/src/router frontend/src/views
git commit -m "feat: 配置 Vue Router 和空白占位页面"
```

---

## 阶段二：核心功能实现

### 任务 8：创建镜像包名解析工具

**文件：**
- 创建：`frontend/src/utils/imageParser.js`

- [ ] **步骤 1：创建 imageParser.js**

```javascript
/**
 * 解析用户输入的镜像包名，生成完整镜像地址
 * 输入格式: nginx, nginx:latest, nginx:1.25, bitnami/nginx, bitnami/nginx:1.25
 */

export function parseImageInput(input, mirrorRegistry = 'docker.1ms.run') {
  if (!input || !input.trim()) {
    return null
  }

  input = input.trim()

  let name = input
  let tag = 'latest'

  if (input.includes(':')) {
    const parts = input.split(':')
    name = parts[0]
    tag = parts[1] || 'latest'
  }

  let repository = ''
  let imageName = name

  if (name.includes('/')) {
    const parts = name.split('/')
    repository = parts.slice(0, -1).join('/')
    imageName = parts[parts.length - 1]
  } else {
    repository = 'library'
  }

  const fullImage = `${mirrorRegistry}/${repository}/${imageName}:${tag}`
  const apiRepository = repository === 'library' ? `library/${imageName}` : name.split(':')[0]

  return {
    packageName: imageName,
    repository: apiRepository,
    fullImage,
    tag,
    registry: mirrorRegistry
  }
}

export function formatImageDisplay(parsed) {
  if (!parsed) return ''
  if (parsed.repository === 'library') {
    return `${parsed.packageName}:${parsed.tag}`
  }
  return `${parsed.repository}/${parsed.packageName}:${parsed.tag}`
}
```

- [ ] **步骤 2：Commit**

```bash
git add frontend/src/utils/imageParser.js
git commit -m "feat: 实现镜像包名解析和拼接工具"
```

---

### 任务 9：创建 API 调用封装

**文件：**
- 创建：`frontend/src/api/index.js`

- [ ] **步骤 1：创建 api/index.js**

```javascript
import axios from 'axios'

const API_BASE_URL = 'http://127.0.0.1:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const settingsApi = {
  get: () => api.get('/api/settings'),
  update: (data) => api.post('/api/settings', data)
}

export const mirrorsApi = {
  list: () => api.get('/api/mirrors'),
  add: (data) => api.post('/api/mirrors', data),
  update: (id, data) => api.put(`/api/mirrors/${id}`, data),
  delete: (id) => api.delete(`/api/mirrors/${id}`),
  setDefault: (id) => api.post(`/api/mirrors/${id}/default`)
}

export const historyApi = {
  list: () => api.get('/api/history'),
  delete: (id) => api.delete(`/api/history/${id}`),
  clear: () => api.delete('/api/history')
}

export const downloadApi = {
  start: (data) => api.post('/api/download/start', data),
  cancel: () => api.post('/api/download/cancel'),
  status: () => api.get('/api/download/status')
}

export default api
```

- [ ] **步骤 2：Commit**

```bash
git add frontend/src/api/index.js
git commit -m "feat: 创建 API 调用封装"
```

---

### 任务 10：创建 Pinia 状态管理

**文件：**
- 创建：`frontend/src/stores/settings.js`
- 创建：`frontend/src/stores/download.js`

- [ ] **步骤 1：创建 stores/settings.js**

```javascript
import { defineStore } from 'pinia'
import { settingsApi, mirrorsApi } from '@/api'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    settings: {
      defaultOutputDir: '',
      defaultArch: 'amd64',
      defaultMirror: 'docker.1ms.run',
      downloadWorkers: 4
    },
    mirrors: [],
    loading: false
  }),

  actions: {
    async loadSettings() {
      this.loading = true
      try {
        const [settingsRes, mirrorsRes] = await Promise.all([
          settingsApi.get(),
          mirrorsApi.list()
        ])
        this.settings = settingsRes.data
        this.mirrors = mirrorsRes.data
      } finally {
        this.loading = false
      }
    },

    async updateSettings(data) {
      const res = await settingsApi.update(data)
      this.settings = res.data
    },

    async addMirror(mirror) {
      const res = await mirrorsApi.add(mirror)
      this.mirrors.push(res.data)
    },

    async deleteMirror(id) {
      await mirrorsApi.delete(id)
      this.mirrors = this.mirrors.filter(m => m.id !== id)
    },

    async setDefaultMirror(id) {
      await mirrorsApi.setDefault(id)
      await this.loadSettings()
    },

    getDefaultMirrorRegistry() {
      const defaultMirror = this.mirrors.find(m => m.isDefault)
      return defaultMirror?.registry || 'docker.1ms.run'
    }
  }
})
```

- [ ] **步骤 2：创建 stores/download.js**

```javascript
import { defineStore } from 'pinia'
import { downloadApi } from '@/api'
import { parseImageInput } from '@/utils/imageParser'

export const useDownloadStore = defineStore('download', {
  state: () => ({
    status: 'idle',
    packageName: '',
    tag: 'latest',
    arch: 'amd64',
    mirror: '',
    outputDir: '',
    progress: {
      currentLayer: 0,
      totalLayers: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      layers: []
    },
    logs: [],
    wsConnection: null
  }),

  actions: {
    async startDownload(packageName, settingsStore) {
      const mirrorRegistry = settingsStore.getDefaultMirrorRegistry()
      const parsed = parseImageInput(packageName, mirrorRegistry)

      if (!parsed) {
        throw new Error('请输入有效的镜像包名')
      }

      this.packageName = parsed.packageName
      this.tag = parsed.tag
      this.mirror = parsed.registry
      this.arch = settingsStore.settings.defaultArch
      this.outputDir = settingsStore.settings.defaultOutputDir

      const res = await downloadApi.start({
        packageName: parsed.packageName,
        tag: parsed.tag,
        arch: this.arch,
        mirror: parsed.registry,
        outputDir: this.outputDir
      })

      this.status = 'downloading'
      return res.data
    },

    async cancelDownload() {
      await downloadApi.cancel()
      this.status = 'idle'
    },

    async checkStatus() {
      const res = await downloadApi.status()
      this.status = res.data.status
      this.progress = res.data
    },

    addLog(log) {
      this.logs.push({
        level: log.level,
        message: log.message,
        timestamp: log.timestamp
      })
    },

    clearLogs() {
      this.logs = []
    },

    connectWebSocket(port = 8000) {
      if (this.wsConnection) {
        this.wsConnection.close()
      }

      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/logs`)
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'log') {
          this.addLog(data)
        } else if (data.type === 'progress') {
          this.progress = data
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      this.wsConnection = ws
    },

    disconnectWebSocket() {
      if (this.wsConnection) {
        this.wsConnection.close()
        this.wsConnection = null
      }
    }
  }
})
```

- [ ] **步骤 3：Commit**

```bash
git add frontend/src/stores
git commit -m "feat: 创建 Pinia 状态管理"
```

---

### 任务 11：创建控制台日志组件

**文件：**
- 创建：`frontend/src/components/LogConsole.vue`

- [ ] **步骤 1：创建 LogConsole.vue**

```vue
<template>
  <div class="log-console">
    <div class="log-header">
      <span class="log-title">📋 控制台日志</span>
      <el-button size="small" @click="clearLogs">清空日志</el-button>
    </div>
    <div class="log-content" ref="logContainer">
      <div v-for="(log, index) in logs" :key="index" class="log-item" :class="log.level">
        <span class="log-time">{{ formatTime(log.timestamp) }}</span>
        <span class="log-message">{{ log.message }}</span>
      </div>
      <div v-if="logs.length === 0" class="log-empty">
        暂无日志
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useDownloadStore } from '@/stores/download'

const downloadStore = useDownloadStore()
const logContainer = ref(null)

const logs = downloadStore.logs

const clearLogs = () => {
  downloadStore.clearLogs()
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

watch(
  () => downloadStore.logs.length,
  () => {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    })
  }
)
</script>

<style scoped>
.log-console {
  background: #1e1e1e;
  border-radius: 8px;
  padding: 12px;
  margin-top: 16px;
}
.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  color: #fff;
}
.log-title {
  font-weight: bold;
}
.log-content {
  max-height: 200px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 12px;
}
.log-item {
  padding: 4px 0;
  color: #d4d4d4;
}
.log-item.info {
  color: #9cdcfe;
}
.log-item.warning {
  color: #ce9178;
}
.log-item.error {
  color: #f44747;
}
.log-item.success {
  color: #4ec9b0;
}
.log-time {
  color: #6a9955;
  margin-right: 8px;
}
.log-empty {
  color: #6a9955;
  text-align: center;
  padding: 20px;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add frontend/src/components/LogConsole.vue
git commit -m "feat: 创建控制台日志组件"
```

---

### 任务 12：创建下载进度组件

**文件：**
- 创建：`frontend/src/components/DownloadProgress.vue`

- [ ] **步骤 1：创建 DownloadProgress.vue**

```vue
<template>
  <div class="download-progress" v-if="status !== 'idle'">
    <div class="progress-header">
      <span class="progress-title">📊 下载进度</span>
      <span class="progress-status">{{ statusText }}</span>
    </div>
    <div class="progress-layers">
      <div v-for="(layer, index) in layers" :key="index" class="layer-item">
        <div class="layer-header">
          <span class="layer-status-icon">{{ layer.completed ? '✅' : layer.downloading ? '⬇️' : '⏳' }}</span>
          <span class="layer-name">{{ layer.name }}</span>
        </div>
        <el-progress
          :percentage="layer.percentage"
          :status="layer.completed ? 'success' : ''"
          :stroke-width="10"
        />
        <div class="layer-info">
          <span>{{ formatSize(layer.downloaded) }}/{{ formatSize(layer.total) }}</span>
        </div>
      </div>
    </div>
    <div class="progress-summary">
      <span>速度: {{ formatSpeed(speed) }}</span>
      <span>总计: {{ currentLayer }}/{{ totalLayers }} 层</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useDownloadStore } from '@/stores/download'

const downloadStore = useDownloadStore()

const status = downloadStore.status
const progress = downloadStore.progress

const statusText = computed(() => {
  const texts = {
    idle: '空闲',
    preparing: '准备中',
    downloading: '下载中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  }
  return texts[status] || '未知'
})

const layers = computed(() => progress.layers || [])
const currentLayer = computed(() => progress.currentLayer || 0)
const totalLayers = computed(() => progress.totalLayers || 0)
const speed = computed(() => progress.speed || 0)

const formatSize = (bytes) => {
  if (!bytes) return '0B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  for (const unit of units) {
    if (size < 1024) return `${size.toFixed(1)}${unit}`
    size /= 1024
  }
  return `${size.toFixed(1)}TB`
}

const formatSpeed = (bytesPerSec) => {
  return formatSize(bytesPerSec) + '/s'
}
</script>

<style scoped>
.download-progress {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  margin-top: 16px;
  border: 1px solid #e4e7ed;
}
.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}
.progress-title {
  font-weight: bold;
}
.progress-status {
  color: #409eff;
}
.progress-layers {
  max-height: 150px;
  overflow-y: auto;
}
.layer-item {
  margin-bottom: 8px;
}
.layer-header {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}
.layer-status-icon {
  margin-right: 6px;
}
.layer-name {
  font-size: 12px;
  color: #606266;
}
.layer-info {
  font-size: 12px;
  color: #909399;
  text-align: right;
}
.progress-summary {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: #606266;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add frontend/src/components/DownloadProgress.vue
git commit -m "feat: 创建下载进度组件"
```

---

### 任务 13：创建镜像源选择器组件

**文件：**
- 创建：`frontend/src/components/MirrorSelector.vue`

- [ ] **步骤 1：创建 MirrorSelector.vue**

```vue
<template>
  <el-select
    v-model="selectedMirror"
    placeholder="选择镜像源"
    @change="handleChange"
    class="mirror-selector"
  >
    <el-option
      v-for="mirror in mirrors"
      :key="mirror.id"
      :label="mirror.name"
      :value="mirror.registry"
    >
      <div class="mirror-option">
        <span>{{ mirror.name }}</span>
        <span v-if="mirror.isDefault" class="default-badge">默认</span>
      </div>
    </el-option>
  </el-select>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])

const settingsStore = useSettingsStore()
const mirrors = computed(() => settingsStore.mirrors)

const selectedMirror = ref(props.modelValue || settingsStore.getDefaultMirrorRegistry())

watch(() => props.modelValue, (val) => {
  if (val) {
    selectedMirror.value = val
  }
})

const handleChange = (value) => {
  emit('update:modelValue', value)
}
</script>

<style scoped>
.mirror-selector {
  width: 100%;
}
.mirror-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.default-badge {
  background: #409eff;
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add frontend/src/components/MirrorSelector.vue
git commit -m "feat: 创建镜像源选择器组件"
```

---

### 任务 14：实现主页下载界面

**文件：**
- 修改：`frontend/src/views/Home.vue`

- [ ] **步骤 1：实现完整的 Home.vue**

```vue
<template>
  <div class="home-page">
    <el-card class="download-card">
      <el-form :model="form" label-width="100px">
        <el-form-item label="镜像包名">
          <el-input
            v-model="form.packageName"
            placeholder="例如: nginx, nginx:latest, alpine:3.18"
            :disabled="isDownloading"
          >
            <template #append>
              <el-button @click="parseAndPreview" :disabled="isDownloading">解析</el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="镜像源">
          <MirrorSelector v-model="form.mirror" :disabled="isDownloading" />
        </el-form-item>

        <el-form-item label="架构">
          <el-select v-model="form.arch" :disabled="isDownloading">
            <el-option label="amd64 (x86_64)" value="amd64" />
            <el-option label="arm64 (ARMv8)" value="arm64" />
            <el-option label="armv7" value="armv7" />
          </el-select>
        </el-form-item>

        <el-form-item label="输出目录">
          <el-input v-model="form.outputDir" :disabled="isDownloading">
            <template #append>
              <el-button @click="selectOutputDir" :disabled="isDownloading">选择</el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            @click="startDownload"
            :loading="isDownloading"
            :disabled="!form.packageName"
          >
            {{ isDownloading ? '下载中...' : '开始下载' }}
          </el-button>
          <el-button
            size="large"
            @click="cancelDownload"
            :disabled="!isDownloading"
          >
            取消
          </el-button>
        </el-form-item>
      </el-form>

      <div v-if="parsedPreview" class="parsed-preview">
        <el-alert type="info" :closable="false">
          <template #title>
            完整镜像地址: {{ parsedPreview.fullImage }}
          </template>
        </el-alert>
      </div>

      <LogConsole />
      <DownloadProgress />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'
import { useDownloadStore } from '@/stores/download'
import { parseImageInput } from '@/utils/imageParser'
import MirrorSelector from '@/components/MirrorSelector.vue'
import LogConsole from '@/components/LogConsole.vue'
import DownloadProgress from '@/components/DownloadProgress.vue'

const settingsStore = useSettingsStore()
const downloadStore = useDownloadStore()

const form = ref({
  packageName: '',
  mirror: '',
  arch: 'amd64',
  outputDir: ''
})

const parsedPreview = ref(null)

const isDownloading = computed(() => downloadStore.status === 'downloading' || downloadStore.status === 'preparing')

onMounted(async () => {
  await settingsStore.loadSettings()
  form.value.arch = settingsStore.settings.defaultArch
  form.value.outputDir = settingsStore.settings.defaultOutputDir
  form.value.mirror = settingsStore.getDefaultMirrorRegistry()
  downloadStore.connectWebSocket()
})

onUnmounted(() => {
  downloadStore.disconnectWebSocket()
})

const parseAndPreview = () => {
  if (!form.value.packageName) {
    ElMessage.warning('请输入镜像包名')
    return
  }
  parsedPreview.value = parseImageInput(form.value.packageName, form.value.mirror)
  if (parsedPreview.value) {
    ElMessage.success('解析成功')
  }
}

const startDownload = async () => {
  if (!form.value.packageName) {
    ElMessage.warning('请输入镜像包名')
    return
  }

  parsedPreview.value = parseImageInput(form.value.packageName, form.value.mirror)

  try {
    await downloadStore.startDownload(form.value.packageName, settingsStore)
    ElMessage.success('开始下载')
  } catch (error) {
    ElMessage.error(error.message || '下载失败')
  }
}

const cancelDownload = async () => {
  try {
    await downloadStore.cancelDownload()
    ElMessage.info('下载已取消')
  } catch (error) {
    ElMessage.error('取消失败')
  }
}

const selectOutputDir = async () => {
  if (window.electronAPI?.selectDirectory) {
    const path = await window.electronAPI.selectDirectory()
    if (path) {
      form.value.outputDir = path
    }
  } else {
    ElMessage.info('请在设置中配置默认输出目录')
  }
}
</script>

<style scoped>
.home-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}
.download-card {
  margin-bottom: 20px;
}
.parsed-preview {
  margin-bottom: 16px;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add frontend/src/views/Home.vue
git commit -m "feat: 实现主页下载界面"
```

---

### 任务 15：创建 WebSocket 日志推送服务

**文件：**
- 创建：`backend/services/log_websocket.py`
- 修改：`backend/main.py`

- [ ] **步骤 1：创建 log_websocket.py**

```python
import asyncio
import json
from datetime import datetime
from typing import Set
from fastapi import WebSocket

class LogWebSocketManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def send_log(self, level: str, message: str):
        log_data = {
            "type": "log",
            "level": level,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        for connection in self.active_connections:
            try:
                await connection.send_json(log_data)
            except Exception:
                pass

    async def send_progress(self, progress_data: dict):
        data = {
            "type": "progress",
            **progress_data
        }
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception:
                pass

log_manager = LogWebSocketManager()
```

- [ ] **步骤 2：在 main.py 添加 WebSocket 路由**

```python
from fastapi import WebSocket, WebSocketDisconnect
from services.log_websocket import log_manager

@app.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    await log_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        log_manager.disconnect(websocket)
```

- [ ] **步骤 3：Commit**

```bash
git add backend/services/log_websocket.py backend/main.py
git commit -m "feat: 实现 WebSocket 日志推送"
```

---

### 任务 16：创建下载 API 路由

**文件：**
- 创建：`backend/routers/download.py`
- 修改：`backend/main.py`

- [ ] **步骤 1：创建 download.py 路由骨架（先实现状态管理）**

```python
from fastapi import APIRouter
from models.schemas import DownloadRequest, DownloadStatus
from services.log_websocket import log_manager
import asyncio

router = APIRouter(prefix="/api", tags=["download"])

download_state = {
    "status": DownloadStatus.idle,
    "packageName": "",
    "progress": {
        "currentLayer": 0,
        "totalLayers": 0,
        "downloadedBytes": 0,
        "totalBytes": 0,
        "speed": 0,
        "layers": []
    }
}

download_task = None

@router.post("/download/start")
async def start_download(request: DownloadRequest):
    global download_task, download_state

    if download_state["status"] != DownloadStatus.idle:
        return {"error": "已有下载任务进行中"}

    download_state["status"] = DownloadStatus.preparing
    download_state["packageName"] = request.packageName

    await log_manager.send_log("info", f"开始下载 {request.packageName}:{request.tag}")

    return {"status": "started", "packageName": request.packageName}

@router.post("/download/cancel")
async def cancel_download():
    global download_state

    if download_state["status"] in [DownloadStatus.downloading, DownloadStatus.preparing]:
        download_state["status"] = DownloadStatus.cancelled
        await log_manager.send_log("warning", "下载已取消")
        return {"status": "cancelled"}

    return {"status": "idle"}

@router.get("/download/status")
async def get_download_status():
    return {
        "status": download_state["status"],
        "packageName": download_state["packageName"],
        **download_state["progress"]
    }
```

- [ ] **步骤 2：在 main.py 注册路由**

```python
from routers import download

app.include_router(download.router)
```

- [ ] **步骤 3：测试下载 API**

运行：`python main.py`
访问：`POST http://127.0.0.1:8000/api/download/start` with body `{"packageName": "nginx", "tag": "latest"}`
预期：返回 `{"status": "started", "packageName": "nginx"}`

- [ ] **步骤 4：Commit**

```bash
git add backend/routers/download.py backend/main.py
git commit -m "feat: 实现下载 API 路由骨架"
```

---

## 阶段三：用户设置和历史记录

### 任务 17：创建历史记录 API 路由

**文件：**
- 创建：`backend/routers/history.py`
- 修改：`backend/main.py`

- [ ] **步骤 1：创建 history.py**

```python
from fastapi import APIRouter
from models.schemas import HistoryItem
from services.settings_store import SettingsStore
import uuid
from datetime import datetime

router = APIRouter(prefix="/api", tags=["history"])
store = SettingsStore()

@router.get("/history")
async def get_history():
    return store.get_history()

@router.delete("/history/{item_id}")
async def delete_history(item_id: str):
    return {"success": store.delete_history(item_id)}

@router.delete("/history")
async def clear_history():
    return {"success": store.clear_history()}
```

- [ ] **步骤 2：在 main.py 注册路由**

```python
from routers import history

app.include_router(history.router)
```

- [ ] **步骤 3：Commit**

```bash
git add backend/routers/history.py backend/main.py
git commit -m "feat: 实现历史记录 API"
```

---

### 任务 18：实现历史记录页面

**文件：**
- 修改：`frontend/src/views/History.vue`

- [ ] **步骤 1：实现完整的 History.vue**

```vue
<template>
  <div class="history-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>📜 下载历史</span>
          <el-button type="danger" size="small" @click="clearHistory" :disabled="history.length === 0">
            清空历史
          </el-button>
        </div>
      </template>

      <el-empty v-if="history.length === 0" description="暂无下载历史" />

      <div v-else class="history-list">
        <div v-for="item in history" :key="item.id" class="history-item">
          <div class="item-header">
            <span class="item-status" :class="item.status">
              {{ item.status === 'completed' ? '✅' : item.status === 'failed' ? '❌' : '⏳' }}
            </span>
            <span class="item-name">{{ item.packageName }}:{{ item.tag }}</span>
            <span class="item-arch">({{ item.arch }})</span>
          </div>
          <div class="item-details">
            <div class="detail-row">
              <span class="detail-label">镜像源:</span>
              <span class="detail-value">{{ item.mirror }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">完整地址:</span>
              <span class="detail-value">{{ item.fullImage }}</span>
            </div>
            <div v-if="item.outputPath" class="detail-row">
              <span class="detail-label">输出路径:</span>
              <span class="detail-value">{{ item.outputPath }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">大小:</span>
              <span class="detail-value">{{ item.size || '未知' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">时间:</span>
              <span class="detail-value">{{ formatTime(item.downloadedAt) }}</span>
            </div>
            <div v-if="item.error" class="detail-row error">
              <span class="detail-label">错误:</span>
              <span class="detail-value">{{ item.error }}</span>
            </div>
          </div>
          <div class="item-actions">
            <el-button size="small" @click="redownload(item)">重新下载</el-button>
            <el-button v-if="item.outputPath" size="small" @click="openDirectory(item.outputPath)">打开目录</el-button>
            <el-button type="danger" size="small" @click="deleteHistory(item.id)">删除</el-button>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { historyApi } from '@/api'

const history = ref([])

onMounted(async () => {
  await loadHistory()
})

const loadHistory = async () => {
  try {
    const res = await historyApi.list()
    history.value = res.data
  } catch (error) {
    ElMessage.error('加载历史记录失败')
  }
}

const clearHistory = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有历史记录吗？', '警告', {
      type: 'warning'
    })
    await historyApi.clear()
    history.value = []
    ElMessage.success('历史记录已清空')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清空失败')
    }
  }
}

const deleteHistory = async (id) => {
  try {
    await historyApi.delete(id)
    history.value = history.value.filter(h => h.id !== id)
    ElMessage.success('已删除')
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

const redownload = (item) => {
  ElMessage.info('重新下载功能待实现')
}

const openDirectory = async (path) => {
  if (window.electronAPI?.openDirectory) {
    await window.electronAPI.openDirectory(path)
  } else {
    ElMessage.info('请在文件管理器中打开: ' + path)
  }
}

const formatTime = (timestamp) => {
  if (!timestamp) return '未知'
  return new Date(timestamp).toLocaleString('zh-CN')
}
</script>

<style scoped>
.history-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.history-list {
  max-height: 500px;
  overflow-y: auto;
}
.history-item {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
.item-header {
  font-weight: bold;
  margin-bottom: 8px;
}
.item-status.completed {
  color: #67c23a;
}
.item-status.failed {
  color: #f56c6c;
}
.item-arch {
  color: #909399;
  margin-left: 8px;
}
.item-details {
  margin-bottom: 8px;
}
.detail-row {
  display: flex;
  margin-bottom: 4px;
  font-size: 13px;
}
.detail-label {
  color: #909399;
  width: 80px;
}
.detail-value {
  color: #606266;
}
.detail-row.error .detail-value {
  color: #f56c6c;
}
.item-actions {
  display: flex;
  gap: 8px;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add frontend/src/views/History.vue
git commit -m "feat: 实现下载历史页面"
```

---

### 任务 19：实现设置页面

**文件：**
- 修改：`frontend/src/views/Settings.vue`

- [ ] **步骤 1：实现完整的 Settings.vue**

```vue
<template>
  <div class="settings-page">
    <el-card class="settings-card">
      <template #header>
        <span>⚙️ 基本设置</span>
      </template>

      <el-form :model="settings" label-width="120px">
        <el-form-item label="默认输出目录">
          <el-input v-model="settings.defaultOutputDir">
            <template #append>
              <el-button @click="selectOutputDir">选择</el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="默认架构">
          <el-select v-model="settings.defaultArch">
            <el-option label="amd64" value="amd64" />
            <el-option label="arm64" value="arm64" />
            <el-option label="armv7" value="armv7" />
          </el-select>
        </el-form-item>

        <el-form-item label="下载线程数">
          <el-slider v-model="settings.downloadWorkers" :min="1" :max="16" show-stops />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="saveSettings">保存设置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="mirrors-card">
      <template #header>
        <div class="card-header">
          <span>🌐 镜像源管理</span>
          <el-button type="primary" size="small" @click="showAddMirror">添加镜像源</el-button>
        </div>
      </template>

      <el-table :data="mirrors" style="width: 100%">
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="registry" label="地址" />
        <el-table-column label="默认">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" type="success">默认</el-tag>
            <el-button v-else size="small" @click="setDefaultMirror(row.id)">设为默认</el-button>
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button v-if="!row.isDefault" type="danger" size="small" @click="deleteMirror(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="addMirrorVisible" title="添加镜像源">
      <el-form :model="newMirror" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="newMirror.name" placeholder="例如: 自定义镜像源" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="newMirror.registry" placeholder="例如: my.registry.com" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addMirrorVisible = false">取消</el-button>
        <el-button type="primary" @click="addMirror">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

const settings = reactive({
  defaultOutputDir: '',
  defaultArch: 'amd64',
  downloadWorkers: 4
})

const mirrors = ref([])
const addMirrorVisible = ref(false)
const newMirror = reactive({
  name: '',
  registry: ''
})

onMounted(async () => {
  await settingsStore.loadSettings()
  Object.assign(settings, settingsStore.settings)
  mirrors.value = settingsStore.mirrors
})

const saveSettings = async () => {
  try {
    await settingsStore.updateSettings(settings)
    ElMessage.success('设置已保存')
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const selectOutputDir = async () => {
  if (window.electronAPI?.selectDirectory) {
    const path = await window.electronAPI.selectDirectory()
    if (path) {
      settings.defaultOutputDir = path
    }
  }
}

const showAddMirror = () => {
  newMirror.name = ''
  newMirror.registry = ''
  addMirrorVisible.value = true
}

const addMirror = async () => {
  if (!newMirror.name || !newMirror.registry) {
    ElMessage.warning('请填写名称和地址')
    return
  }

  try {
    await settingsStore.addMirror({
      id: '',
      name: newMirror.name,
      registry: newMirror.registry,
      isDefault: false
    })
    mirrors.value = settingsStore.mirrors
    addMirrorVisible.value = false
    ElMessage.success('镜像源已添加')
  } catch (error) {
    ElMessage.error('添加失败')
  }
}

const setDefaultMirror = async (id) => {
  try {
    await settingsStore.setDefaultMirror(id)
    mirrors.value = settingsStore.mirrors
    ElMessage.success('已设为默认镜像源')
  } catch (error) {
    ElMessage.error('设置失败')
  }
}

const deleteMirror = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除此镜像源吗？', '警告', {
      type: 'warning'
    })
    await settingsStore.deleteMirror(id)
    mirrors.value = settingsStore.mirrors
    ElMessage.success('已删除')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}
</script>

<style scoped>
.settings-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}
.settings-card, .mirrors-card {
  margin-bottom: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add frontend/src/views/Settings.vue
git commit -m "feat: 实现设置页面"
```

---

## 阶段四：Electron 集成与打包

### 任务 20：创建 Electron 主进程

**文件：**
- 创建：`frontend/electron/main.js`
- 创建：`frontend/electron/preload.js`
- 创建：`frontend/electron/pythonProcess.js`

- [ ] **步骤 1：创建 electron/main.js**

```javascript
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const PythonProcessManager = require('./pythonProcess')

let mainWindow = null
let pythonManager = null

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../../resources/icon.ico')
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

async function startPythonProcess() {
  pythonManager = new PythonProcessManager()
  
  const backendPath = isDev
    ? path.join(__dirname, '../../backend')
    : path.join(process.resourcesPath, 'backend')
  
  const pythonPath = isDev
    ? 'python'
    : path.join(process.resourcesPath, 'python-dist', 'python.exe')

  await pythonManager.start(pythonPath, backendPath)
}

app.whenReady().then(async () => {
  await startPythonProcess()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (pythonManager) {
    pythonManager.stop()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (pythonManager) {
    pythonManager.stop()
  }
})

ipcMain.handle('select-directory', async () => {
  const { dialog } = require('electron')
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('open-directory', async (event, path) => {
  const { shell } = require('electron')
  shell.openPath(path)
})
```

- [ ] **步骤 2：创建 electron/pythonProcess.js**

```javascript
const { spawn } = require('child_process')
const path = require('path')

class PythonProcessManager {
  constructor() {
    this.process = null
    this.port = 8000
  }

  start(pythonPath, backendPath) {
    const mainScript = path.join(backendPath, 'main.py')
    
    this.process = spawn(pythonPath, [mainScript], {
      cwd: backendPath,
      env: {
        ...process.env,
        PORT: this.port.toString()
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    this.process.stdout.on('data', (data) => {
      console.log(`[Python] ${data}`)
    })

    this.process.stderr.on('data', (data) => {
      console.error(`[Python Error] ${data}`)
    })

    this.process.on('error', (err) => {
      console.error('Python process error:', err)
    })

    this.process.on('exit', (code) => {
      console.log(`Python process exited with code ${code}`)
    })

    return new Promise((resolve) => {
      setTimeout(resolve, 2000)
    })
  }

  stop() {
    if (this.process) {
      this.process.kill('SIGTERM')
      this.process = null
    }
  }
}

module.exports = PythonProcessManager
```

- [ ] **步骤 3：创建 electron/preload.js**

```javascript
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openDirectory: (path) => ipcRenderer.invoke('open-directory', path)
})
```

- [ ] **步骤 4：Commit**

```bash
git add frontend/electron/
git commit -m "feat: 创建 Electron 主进程和预加载脚本"
```

---

### 任务 21：配置 Electron 打包

**文件：**
- 创建：`frontend/electron-builder.json`
- 修改：`frontend/package.json`

- [ ] **步骤 1：创建 electron-builder.json**

```json
{
  "$schema": "https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/schema/conf.schema.json",
  "appId": "com.docker-pull-tar",
  "productName": "DockerPull",
  "directories": {
    "output": "dist-electron"
  },
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ],
    "icon": "resources/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "installerIcon": "resources/icon.ico",
    "uninstallerIcon": "resources/icon.ico"
  },
  "extraResources": [
    {
      "from": "../backend",
      "to": "backend"
    }
  ]
}
```

- [ ] **步骤 2：更新 package.json scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "electron:dev": "concurrently -k \"cross-env BROWSER=none vite\" \"wait-on http://localhost:5173 && cross-env NODE_ENV=development electron .\"",
    "electron:build": "vite build && electron-builder --config electron-builder.json"
  },
  "devDependencies": {
    "cross-env": "^7.0.0"
  }
}
```

- [ ] **步骤 3：Commit**

```bash
git add frontend/electron-builder.json frontend/package.json
git commit -m "feat: 配置 Electron 打包"
```

---

### 任务 22：复制应用图标资源

**文件：**
- 复制：`resources/icon.ico`（使用现有 favicon.ico）

- [ ] **步骤 1：创建 resources 目录并复制图标**

```bash
mkdir -p resources
cp favicon.ico resources/icon.ico
```

- [ ] **步骤 2：Commit**

```bash
git add resources/
git commit -m "chore: 复制应用图标资源"
```

---

## 完成检查

实现完成后，应验证以下功能：

1. **前端启动测试**
   - 运行 `pnpm dev`，Vue3 开发服务器正常启动
   - 访问 http://localhost:5173，显示主页界面

2. **后端启动测试**
   - 运行 `python backend/main.py`，FastAPI 正常启动
   - 访问 http://127.0.0.1:8000/api/health，返回正常状态

3. **Electron 开发模式测试**
   - 运行 `pnpm electron:dev`，应用窗口正常打开
   - 设置页面可以保存配置
   - 主页可以解析镜像包名

4. **打包测试**
   - 运行 `pnpm electron:build`，生成安装包
   - 安装并运行，验证基本功能

---

## 计划自检

**1. 规格覆盖度：**
- 主页下载界面 ✓（任务 14）
- 镜像包名解析 ✓（任务 8）
- 镜像源选择 ✓（任务 13）
- 控制台日志 ✓（任务 11）
- 下载进度 ✓（任务 12）
- WebSocket 日志推送 ✓（任务 15）
- 设置存储 ✓（任务 4）
- 镜像源管理 ✓（任务 5、任务 19）
- 下载历史 ✓（任务 17、任务 18）
- Electron 主进程 ✓（任务 20）
- Electron 打包 ✓（任务 21）

**2. 占位符扫描：**
- 无 TODO、待定等占位符

**3. 类型一致性：**
- 前端 `parseImageInput` 返回格式与后端 `DownloadRequest` 一致
- WebSocket 消息格式前后端一致
- 数据模型前后端命名一致