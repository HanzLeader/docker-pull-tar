# Electron 打包优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 移除 Electron 打包配置中的冗余 backend 源代码目录，只保留 backend.exe

**架构：** 修改 electron-builder.json 的 extraResources 配置，精简打包体积约 30MB+

**技术栈：** Electron Builder、PyInstaller、Vue 3、FastAPI

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `frontend/electron-builder.json` | 修改 | Electron 打包配置，移除冗余 backend 目录打包 |
| `frontend/dist-electron/win-unpacked/` | 生成 | 打包输出目录 |

---

### 任务 1：修改打包配置

**文件：**
- 修改：`frontend/electron-builder.json:17-26`

- [ ] **步骤 1：修改 extraResources 配置**

移除冗余的 backend 源代码目录打包项：

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
        "target": "dir",
        "arch": ["x64"]
      }
    ],
    "sign": null
  },
  "extraResources": [
    {
      "from": "../backend-dist/backend.exe",
      "to": "backend/backend.exe"
    }
  ]
}
```

- [ ] **步骤 2：清理旧的打包输出**

```bash
rm -rf frontend/dist-electron
rm -rf frontend/dist
```

- [ ] **步骤 3：Commit 配置修改**

```bash
git add frontend/electron-builder.json
git commit -m "fix: 移除冗余的 backend 源代码打包配置"
```

---

### 任务 2：重新打包

**文件：**
- 无代码修改，执行打包命令

- [ ] **步骤 1：确认 backend.exe 存在**

```bash
ls -la backend-dist/backend.exe
```
预期：显示约 22MB 的 backend.exe 文件

- [ ] **步骤 2：编译 Electron TypeScript 代码**

```bash
cd frontend && npm run electron:compile && cd ..
```

- [ ] **步骤 3：构建前端 Vite 产物**

```bash
cd frontend && npm run build && cd ..
```

- [ ] **步骤 4：执行 Electron Builder 打包**

```bash
cd frontend && npx electron-builder --config electron-builder.json && cd ..
```

- [ ] **步骤 5：验证打包输出结构**

```bash
ls -la frontend/dist-electron/win-unpacked/resources/backend/
```
预期：只显示 `backend.exe`，不再有 routers、services 等源代码目录

---

### 任务 3：运行验证

**文件：**
- 无代码修改，执行验证测试

- [ ] **步骤 1：Kill 占用端口进程**

```bash
# 查找并终止 5173 端口进程（Vite dev server）
netstat -ano | grep 5173 | awk '{print $5}' | xargs -r taskkill //F //PID

# 查找并终止 8000 端口进程（FastAPI backend）
netstat -ano | grep 8000 | awk '{print $5}' | xargs -r taskkill //F //PID
```

- [ ] **步骤 2：启动打包后的应用**

```bash
./frontend/dist-electron/win-unpacked/DockerPull.exe
```

- [ ] **步骤 3：验证后端 API 响应**

等待应用启动（约 2-3 秒），然后检查 API：

```bash
curl http://127.0.0.1:8000/api/health
```
预期响应：`{"status": "ok", "version": "2.0.0"}`

- [ ] **步骤 4：测试基本功能**

在应用界面中：
1. 检查镜像选择下拉框能正常显示镜像列表
2. 检查历史记录页面能正常加载
3. 输入一个测试镜像名（如 `alpine`）并尝试下载

- [ ] **步骤 5：关闭应用并验证进程退出**

关闭 DockerPull.exe 窗口，确认 backend.exe 进程也被终止：

```bash
netstat -ano | grep 8000
```
预期：无输出（端口已释放）

---

### 任务 4：完成并提交

- [ ] **步骤 1：确认打包体积变化**

```bash
du -sh frontend/dist-electron/win-unpacked/resources/backend/
```
预期：约 22MB（仅 backend.exe），比之前减少约 30MB+

- [ ] **步骤 2：提交打包产物（可选）**

如果需要将打包结果纳入版本控制：

```bash
git add frontend/dist-electron/
git commit -m "build: Electron 打包优化，移除冗余 backend 源代码"
```

---

## 自检

1. **规格覆盖度：** ✓ 配置修改（任务1）、重新打包（任务2）、验证（任务3）
2. **占位符扫描：** ✓ 无 TODO/待定
3. **类型一致性：** ✓ 无新增类型定义