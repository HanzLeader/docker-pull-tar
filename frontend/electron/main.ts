import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import PythonProcessManager from './pythonProcess'

let mainWindow: BrowserWindow | null = null
let pythonManager: PythonProcessManager | null = null

const isDev: boolean = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableWebSQL: false,
      spellcheck: false
    },
    icon: path.join(__dirname, '../../resources/icon.ico')
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

  const backendPath: string = isDev
    ? path.join(__dirname, '../../backend')
    : path.join(process.resourcesPath, 'backend')

  const pythonPath: string = isDev
    ? 'python'
    : path.join(process.resourcesPath, 'backend', 'backend.exe')

  await pythonManager.start(pythonPath, backendPath)
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