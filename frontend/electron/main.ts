import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import path from 'path'
import PythonProcessManager from './pythonProcess'

let mainWindow: BrowserWindow | null = null
let pythonManager: PythonProcessManager | null = null
let isQuitting = false

const isDev: boolean = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow(): void {
  // 隐藏默认菜单栏
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableWebSQL: false,
      spellcheck: false
    },
    icon: path.join(__dirname, '../../resources/icon.ico')
  })

  // 监听窗口关闭事件
  mainWindow.on('close', (e): void => {
    if (!isQuitting) {
      e.preventDefault()
      isQuitting = true
      // 先停止后端进程
      if (pythonManager) {
        pythonManager.stop()
      }
      // 然后关闭窗口
      mainWindow?.destroy()
      mainWindow = null
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()

    mainWindow.webContents.on('devtools-opened', () => {
      // DevTools 打开后的处理
    })
  } else {
    // 打包后 Vite 构建的 index.html 在 app.asar/dist/index.html
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

async function startPythonProcess(): Promise<void> {
  pythonManager = new PythonProcessManager()

  // 开发模式下 __dirname = frontend/dist-electron/electron
  // 需要向上 3 级到达项目根目录
  const projectRoot = isDev
    ? path.resolve(__dirname, '../../..')
    : process.resourcesPath

  const backendPath: string = path.join(projectRoot, 'backend')
  const configPath: string = path.join(projectRoot, 'startup.config.json')

  console.log('[Python] Project root:', projectRoot)
  console.log('[Python] Config path:', configPath)

  pythonManager.loadConfig(configPath)

  // 打包模式下强制使用 exe 模式
  if (!isDev) {
    const config = pythonManager.getConfig()
    // 打包模式下，确保使用 exe 启动
    if (config.startupMode === 'none' || config.startupMode === 'python' || config.startupMode === 'conda') {
      console.log('[Python] Packaged mode: overriding startupMode to exe')
      pythonManager.setConfig({
        ...config,
        startupMode: 'exe',
        pythonPath: path.join(process.resourcesPath, 'backend', 'backend.exe')
      })
    }
  }

  await pythonManager.start(backendPath)
}

app.whenReady().then(async (): Promise<void> => {
  await startPythonProcess()
  createWindow()

  app.on('activate', (): void => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', (): void => {
  if (pythonManager) {
    pythonManager.stop()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', (): void => {
  isQuitting = true
  if (pythonManager) {
    pythonManager.stop()
  }
})

// 确保应用退出时清理
app.on('will-quit', (): void => {
  if (pythonManager) {
    pythonManager.stop()
  }
})

ipcMain.handle('select-directory', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('open-directory', async (_event: Electron.IpcMainInvokeEvent, dirPath: string): Promise<void> => {
  shell.openPath(dirPath)
})