---
name: Electron + FastAPI 打包优化设计
description: 移除冗余打包，精简为只包含 backend.exe
type: project
---

# Electron + FastAPI 打包优化设计

## 背景

项目是前后端分离架构：
- 前端：Vue 3 + Electron + Element Plus + Vite + TypeScript
- 后端：FastAPI + Python + uvicorn

当前打包存在冗余：`electron-builder.json` 同时打包 backend.exe 和 backend 源代码目录，但 backend.exe 已通过 PyInstaller 内含所有源代码。

## 问题

`extraResources` 配置冗余：
```json
"extraResources": [
  { "from": "../backend-dist/backend.exe", "to": "backend/backend.exe" },
  { "from": "../backend", "to": "backend" }  // 冗余
]
```

打包后 `resources/backend/` 包含 backend.exe（22MB）+ 源代码目录，造成约 30MB+ 重复。

## 解决方案

**Why:** 精简打包体积，避免冗余
**How to apply:** 只打包 backend.exe

修改 `electron-builder.json`：
```json
"extraResources": [
  { "from": "../backend-dist/backend.exe", "to": "backend/backend.exe" }
]
```

## 目标目录结构

```
win-unpacked/
├── DockerPull.exe          (主程序入口)
├── resources/
│   ├── app.asar            (前端 Vue 代码)
│   └── backend/
│       └── backend.exe     (后端服务，独立运行)
└── ... (Electron/Chromium 依赖文件)
```

## 代码适配

`pythonProcess.ts` 路径逻辑已正确，无需修改：
```typescript
// 打包模式路径
const pythonPath = path.join(process.resourcesPath, 'backend', 'backend.exe')
```

## 验证步骤

1. Kill 占用端口进程（5173 和 8000）
2. 运行 `DockerPull.exe`
3. 检查后端 API 响应：`http://127.0.0.1:8000/api/health`
4. 测试基本功能：
   - 镜像下载流程
   - 历史记录查看
5. 关闭应用，确认后端进程正确退出

## 打包指令总结

### 完整打包流程（首次或大改动）

```bash
# 1. 确保后端已打包
pyinstaller backend.spec --clean --noconfirm
mkdir -p backend-dist
cp dist/backend.exe backend-dist/

# 2. 编译 Electron TypeScript
cd frontend && npm run electron:compile && cd ..

# 3. 构建 Vite 前端
cd frontend && npm run build && cd ..

# 4. Electron Builder 打包
cd frontend && npx electron-builder --config electron-builder.json && cd ..
```

### 快速更新前端代码（修改 Vue 文件后）

```bash
# 终止运行的应用
taskkill //F //IM DockerPull.exe
taskkill //F //IM backend.exe

# 重新构建前端
cd frontend && npm run build && cd ..

# 更新 app.asar（无需重新执行 electron-builder）
cd frontend && \
  npx asar extract dist-electron/win-unpacked/resources/app.asar dist-electron/app-extracted && \
  rm -rf dist-electron/app-extracted/dist && \
  cp -r dist dist-electron/app-extracted/ && \
  npx asar pack dist-electron/app-extracted dist-electron/win-unpacked/resources/app.asar && \
  rm -rf dist-electron/app-extracted
```

### 快速更新 Electron 主进程代码（修改 electron/*.ts 后）

```bash
# 终止运行的应用
taskkill //F //IM DockerPull.exe
taskkill //F //IM backend.exe

# 重新编译 Electron TypeScript
cd frontend && npm run electron:compile && cd ..

# 更新 app.asar
cd frontend && \
  npx asar extract dist-electron/win-unpacked/resources/app.asar dist-electron/app-extracted && \
  cp electron/dist/main.js dist-electron/app-extracted/electron/dist/main.js && \
  npx asar pack dist-electron/app-extracted dist-electron/win-unpacked/resources/app.asar && \
  rm -rf dist-electron/app-extracted
```

## 实施范围

- 修改 `frontend/electron-builder.json`
- 重新打包验证