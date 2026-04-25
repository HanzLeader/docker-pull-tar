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