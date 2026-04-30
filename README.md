# Docker Pull Tar

Docker 镜像下载工具 - 无需 Docker 环境直接下载镜像为 tar 包

## 项目简介

Docker Pull Tar 是一个桌面应用，用于从 Docker 仓库下载镜像并打包为 `.tar` 文件，方便在内网环境中导入使用。

**技术栈：**
- 前端：Vue 3 + Electron + Element Plus + Vite + TypeScript
- 后端：FastAPI + Python + uvicorn

## 特性

- **图形化界面** - 桌面应用，无需命令行操作
- **多镜像源支持** - Docker Hub、1ms.run、DaoCloud 等镜像站
- **私有仓库支持** - 支持带认证的私有仓库
- **多架构选择** - amd64、arm64、armv7 等架构
- **断点续传** - 下载中断后可继续
- **实时日志** - WebSocket 实时显示下载进度
- **历史记录** - 记录下载历史，方便查看

## 安装

### 下载客户端

前往 [Releases](https://github.com/topcss/docker-pull-tar/releases) 下载打包好的客户端，解压后直接运行 `DockerPull.exe`。

### 从源码打包

**环境要求：**
- Node.js 18+ & pnpm
- Python 3.10+ & PyInstaller

```bash
# 1. 克隆项目
git clone https://github.com/topcss/docker-pull-tar.git
cd docker-pull-tar

# 2. 安装前端依赖
pnpm install

# 3. 安装后端依赖
pip install -r backend/requirements.txt
pip install pyinstaller

# 4. 打包后端
pyinstaller backend.spec --noconfirm

# 5. 打包前端（完整打包）
npm run build

# 6. 运行客户端
npm run start
```

### 开发模式

```bash
# 安装依赖
pnpm install

# 开发模式运行（热更新）
npm run dev
```

#### Python 后端启动配置

开发模式通过 `startup.config.json` 配置 Python 后端启动方式：

```json
{
  "startupMode": "conda",
  "condaEnv": "docker-pull-tar",
  "port": 8000
}
```

**启动模式：**

| 模式 | 说明 |
|------|------|
| `none` | 不自动启动，需手动运行 `python backend/main.py` |
| `python` | 使用系统 Python 启动 |
| `conda` | 使用 conda 环境（指定 `condaEnv` 环境名） |
| `exe` | 运行打包后的 backend.exe（打包模式自动使用） |

**常见配置示例：**

```
{ "startupMode": "none" }

// 系统 Python
{ "startupMode": "python" }

// Conda 环境
{ "startupMode": "conda", "condaEnv": "your-env-name" }

// 指定 Python 路径
{ "startupMode": "python", "pythonPath": "C:/Python310/python.exe" }
```

打包后的应用自动使用 `exe` 模式，无需配置。

## 使用方法

### 基本操作

1. 输入镜像名称（如 `nginx:latest`）
2. 选择镜像源（默认 1ms.run）
3. 选择架构（默认 amd64）
4. 选择输出目录
5. 点击开始下载

### 导入镜像

下载完成后，在内网机器上导入：

```bash
docker load -i xxx.tar
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式启动（热更新） |
| `npm run build` | 打包客户端 |
| `npm run start` | 运行打包后的客户端 |

## 项目结构

```
docker-pull-tar/
├── backend/           # Python FastAPI 后端
│   ├── main.py        # 入口文件
│   ├── routers/       # API 路由
│   └── services/      # 业务逻辑
│   └── requirements.txt # Python 依赖
├── backend.spec       # PyInstaller 打包配置
├── dist/              # PyInstaller 输出（backend.exe）
├── frontend/          # Vue 3 + Electron 前端
│   ├── src/           # Vue 源码
│   └── electron/      # Electron 主进程
│   └ electron-builder.json # Electron 打包配置
├── package.json       # 项目配置
├── startup.config.json # Python 后端启动配置（开发模式）
└── README.md
```
