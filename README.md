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
python -m PyInstaller backend.spec --clean --noconfirm
mkdir backend-dist
cp dist/backend.exe backend-dist/

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

## 使用方法

### 基本操作

1. 输入镜像名称（如 `nginx:latest`、`alpine:3.18`）
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
├── backend-dist/      # 打包后的 backend.exe（需自行打包）
├── frontend/          # Vue 3 + Electron 前端
│   ├── src/           # Vue 源码
│   └── electron/      # Electron 主进程
│   └ electron-builder.json # Electron 打包配置
├── package.json       # 项目配置
└── README.md
```

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 [GitHub Issues](https://github.com/topcss/docker-pull-tar/issues)。