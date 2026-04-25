---
name: Docker Pull Desktop App Design
description: Vue3 + Electron + FastAPI 桌面应用设计规格
---

# Docker Pull Desktop App 设计规格

## 概述

将现有的 Docker 镜像拉取命令行工具改造为桌面应用，面向普通用户，提供直观的图形界面，同时保留控制台日志展示功能。

**技术栈：**
- 前端：Vue3 + Vite + Pinia + Element Plus
- 桌面框架：Electron
- 后端：FastAPI（复用现有 Python 核心逻辑）
- 包管理：pnpm
- 打包工具：electron-builder

**目标用户：** 普通用户（需要简洁 UI + 控制台日志可见）

---

## 项目结构

```
docker-pull-tar/
├── frontend/                    # Vue3 前端
│   ├── src/
│   │   ├── views/              # 页面组件
│   │   │   ├── Home.vue        # 主页（搜索下载）
│   │   │   ├── History.vue     # 下载历史
│   │   │   ├── Favorites.vue   # 收藏镜像
│   │   │   └── Settings.vue    # 设置页面
│   │   ├── components/         # 公共组件
│   │   │   ├── LogConsole.vue  # 控制台日志面板
│   │   │   ├── DownloadProgress.vue
│   │   │   └── MirrorSelector.vue
│   │   ├── stores/             # Pinia 状态管理
│   │   ├── api/                # API 调用封装
│   │   └── utils/              # 工具函数
│   │   ├── App.vue
│   │   └── main.js
│   ├── electron/               # Electron 主进程
│   │   ├── main.js             # 主进程入口
│   │   ├── preload.js          # 预加载脚本
│   │   └── pythonProcess.js    # Python 子进程管理
│   ├── package.json
│   ├── vite.config.js
│   └── electron-builder.json
│
├── backend/                     # FastAPI 后端
│   ├── main.py                 # FastAPI 入口
│   ├── routers/
│   │   ├── download.py         # 下载相关 API
│   │   ├── settings.py         # 设置相关 API
│   │   └── history.py          # 历史记录 API
│   ├── services/               # 业务逻辑
│   │   ├── docker_pull.py      # 核心下载逻辑（复用现有代码）
│   │   └── settings_store.py   # 设置存储服务
│   ├── models/                 # 数据模型
│   └── requirements.txt
│
├── python-dist/                 # 嵌入式 Python 解释器（打包时包含）
│
├── resources/                   # 应用资源
│   ├── icon.ico
│   └── installer/
│
├── docker_image_puller.py       # 现有核心代码（保留）
├── README.md
├── package.json                # 根目录 pnpm 工作区配置
└── pnpm-workspace.yaml
```

---

## 核心功能模块

### 1. 主页 - 搜索下载

**界面布局：**

```
┌─────────────────────────────────────────────────────┐
│  🚀 Docker 镜像下载工具                    [设置] [历史] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  镜像名称: [____________] [搜索] [直接下载]           │
│                                                     │
│  镜像站:   [下拉选择 ▼]  默认: Docker Hub             │
│                                                     │
│  架构:     [下拉选择 ▼]  默认: amd64                  │
│                                                     │
│  输出目录: [____________] [选择文件夹]               │
│                                                     │
│  代理设置: [http://proxy:port] (可选)                │
│                                                     │
├─────────────────────────────────────────────────────┤
│  📋 控制台日志                                       │
│  ├───────────────────────────────────────────────┤ │
│  │ [2026-04-26 10:00] 🚀 开始下载 nginx:latest    │ │
│  │ [2026-04-26 10:01] ⬇️ 正在下载 layer 1/5...   │ │
│  │ [2026-04-26 10:02] ✅ 下载完成!                │ │
│  │ [清空日志]                                     │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  📊 下载进度                                        │
│  ├───────────────────────────────────────────────┤ │
│  │ Layer 1: ████████████████░░░░ 80%  45MB/56MB  │ │
│  │ Layer 2: ░░░░░░░░░░░░░░░░░░░░ 等待中          │ │
│  │ 速度: 2.5MB/s                                 │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [开始下载]  [取消]                                  │
└─────────────────────────────────────────────────────┘
```

**功能点：**
- 镜像名称输入，支持直接输入完整名称或关键词搜索
- 镜像站选择（复用现有 MIRROR_SITES 配置）
- 架构自动识别或手动选择
- 实时日志流显示（WebSocket 接收）
- 多层进度条显示
- 断点续传支持

---

### 2. 设置存储

**存储位置：** `%APPDATA%/docker-pull-tar/config.json`

**数据结构：**

```json
{
  "version": "1.0",
  "settings": {
    "defaultOutputDir": "C:\\Downloads",
    "defaultArch": "amd64",
    "defaultMirror": "registry-1.docker.io",
    "proxy": {
      "http": "",
      "https": ""
    },
    "downloadWorkers": 4
  },
  "favorites": [
    {
      "id": "uuid-1",
      "name": "nginx",
      "tag": "latest",
      "arch": "amd64",
      "mirror": "docker.1ms.run",
      "addedAt": "2026-04-26T10:00:00"
    }
  ],
  "history": [
    {
      "id": "uuid-2",
      "name": "alpine",
      "tag": "3.18",
      "arch": "arm64",
      "mirror": "registry-1.docker.io",
      "status": "completed",
      "outputPath": "C:\\Downloads\\alpine_3.18_arm64.tar",
      "downloadedAt": "2026-04-26T10:30:00",
      "size": "5.2MB",
      "error": null
    }
  ]
}
```

---

### 3. 下载历史页面

**界面：**

```
┌─────────────────────────────────────────────────────┐
│  📜 下载历史                                        │
├─────────────────────────────────────────────────────┤
│  [搜索过滤] [状态: 全部▼] [清空历史]                  │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ ✅ nginx:latest (amd64)                     │   │
│  │    镜像站: Docker Hub                       │   │
│  │    路径: C:\Downloads\nginx_latest_amd64.tar│   │
│  │    大小: 142MB    时间: 2026-04-26 10:00    │   │
│  │    [重新下载] [打开目录] [添加到收藏]         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ ❌ redis:7.0 (arm64) - 失败                 │   │
│  │    错误: 网络连接中断                        │   │
│  │    时间: 2026-04-25 15:30                   │   │
│  │    [重新下载]                                │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

### 4. 收藏镜像页面

快速访问常用镜像，一键下载。

---

## 技术架构

### 通信方式

```
Vue3 渲染进程 ←→ Electron 主进程 ←→ FastAPI 子进程
        │                │                  │
   HTTP API        进程管理           业务逻辑
   WebSocket       生命周期           下载服务
```

### HTTP API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/download/start` | 开始下载 |
| POST | `/api/download/cancel` | 取消下载 |
| GET | `/api/download/status` | 获取下载状态 |
| GET | `/api/architectures` | 获取可用架构列表 |
| GET | `/api/settings` | 获取用户设置 |
| POST | `/api/settings` | 保存用户设置 |
| GET | `/api/history` | 获取下载历史 |
| DELETE | `/api/history/:id` | 删除历史记录 |
| GET | `/api/favorites` | 获取收藏列表 |
| POST | `/api/favorites` | 添加收藏 |
| DELETE | `/api/favorites/:id` | 删除收藏 |

### WebSocket

- 路径：`ws://localhost:{port}/ws/logs`
- 消息格式：
```json
{
  "type": "log",
  "level": "info|warning|error|success",
  "message": "...",
  "timestamp": "2026-04-26T10:00:00"
}
```

---

### Electron 主进程职责

```javascript
// electron/main.js 核心逻辑
const { spawn } = require('child_process');
const path = require('path');

class PythonProcessManager {
  constructor() {
    this.pythonProcess = null;
    this.port = null;
  }

  start() {
    const pythonPath = path.join(__dirname, '../python-dist/python.exe');
    const scriptPath = path.join(__dirname, '../backend/main.py');
    
    this.pythonProcess = spawn(pythonPath, [scriptPath], {
      env: { ...process.env, PORT: this.port }
    });
  }

  stop() {
    this.pythonProcess?.kill('SIGTERM');
  }
}
```

**关键职责：**
- 启动/停止 FastAPI 子进程
- 监听进程状态，异常时自动重启
- 管理应用窗口生命周期
- 处理原生操作（选择文件夹、打开目录等）

---

## 错误处理

### 分级策略

| 级别 | 显示方式 | 示例场景 |
|------|----------|----------|
| Info | 控制台日志 | 开始下载、层完成 |
| Warning | 控制台日志 + 黄色标记 | 架构不匹配、网络慢 |
| Error | 控制台日志 + Toast 弹窗 | 下载失败、认证错误 |
| Success | 控制台日志 + 绿色标记 | 全部完成 |

### 进程异常处理

- FastAPI 进程崩溃 → Electron 自动重启，前端提示"服务重连中..."
- 端口冲突 → 自动检测并切换端口（尝试多个端口直到成功）

### 下载状态流转

```
空闲 → 准备中 → 下载中 → 完成/失败
          ↓
       可取消 → 回到空闲
                    ↓
               支持断点续传 → 继续下载
```

---

## 打包配置

### electron-builder

```json
{
  "build": {
    "appId": "com.docker-pull-tar",
    "productName": "DockerPull",
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
      "installerIcon": "resources/icon.ico"
    },
    "extraResources": [
      {
        "from": "python-dist",
        "to": "python-dist"
      },
      {
        "from": "backend",
        "to": "backend"
      }
    ]
  }
}
```

**打包产物：** `DockerPull-Setup-{version}.exe`（约 150MB）

---

## 开发命令

使用 pnpm：

```bash
# 前端开发
cd frontend
pnpm install
pnpm dev              # 启动 Vue3 开发服务器
pnpm electron:dev     # 启动 Electron + 热更新

# 后端开发
cd backend
pip install -r requirements.txt
python main.py        # 启动 FastAPI

# 构建
pnpm build            # 构建前端
pnpm electron:build   # 打包 Electron
```

---

## 依赖清单

### 前端依赖

- Vue 3
- Vite
- Pinia（状态管理）
- Vue Router
- Element Plus（UI 组件库）
- axios（HTTP 请求）

### 后端依赖

- FastAPI
- Uvicorn
- Requests
- urllib3
- tqdm（现有）
- websocket（日志推送）

### Electron 依赖

- electron
- electron-builder
- concurrently（并发运行脚本）

---

## 实现优先级

1. **阶段一：基础架构**
   - 搭建 Vue3 + Electron 项目骨架
   - 实现 FastAPI 子进程管理
   - 配置 pnpm 工作区

2. **阶段二：核心功能**
   - 实现下载 API（复用现有代码）
   - WebSocket 日志推送
   - 主页下载界面

3. **阶段三：用户设置**
   - 设置存储服务
   - 历史记录功能
   - 收藏功能

4. **阶段四：打包发布**
   - 嵌入式 Python 配置
   - electron-builder 打包
   - 测试安装包