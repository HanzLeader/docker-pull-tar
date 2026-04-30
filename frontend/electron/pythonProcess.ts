import { spawn, execSync, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'

interface StartupConfig {
  startupMode: 'none' | 'python' | 'conda' | 'exe'
  pythonPath: string
  condaEnv: string | null
  backendPath: string | null
  port: number
}

const DEFAULT_CONFIG: StartupConfig = {
  startupMode: 'none',
  pythonPath: 'python',
  condaEnv: null,
  backendPath: null,
  port: 8000
}

class PythonProcessManager {
  private process: ChildProcess | null = null
  private config: StartupConfig = DEFAULT_CONFIG

  loadConfig(configPath: string): StartupConfig {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8')
        const config = JSON.parse(content) as Partial<StartupConfig>
        this.config = { ...DEFAULT_CONFIG, ...config }
        console.log('[Python] Config loaded:', this.config.startupMode)
      }
    } catch (err) {
      console.warn('[Python] Failed to load startup config:', err)
    }
    return this.config
  }

  getConfig(): StartupConfig {
    return this.config
  }

  setConfig(config: StartupConfig): void {
    this.config = config
  }

  shouldAutoStart(): boolean {
    return this.config.startupMode !== 'none'
  }

  start(defaultBackendPath: string): Promise<void> {
    const backendPath = this.config.backendPath || defaultBackendPath
    const port = this.config.port

    console.log(`[Python] Startup mode: ${this.config.startupMode}`)
    console.log(`[Python] Backend path: ${backendPath}`)

    switch (this.config.startupMode) {
      case 'none':
        console.log('[Python] Auto-start disabled. Please manually start backend.')
        console.log(`[Python] Run: cd ${backendPath} && python main.py`)
        return Promise.resolve()

      case 'conda':
        return this.startConda(backendPath, port)

      case 'python':
        return this.startPython(backendPath, port)

      case 'exe':
        return this.startExe(backendPath, port)

      default:
        return Promise.resolve()
    }
  }

  private startPython(backendPath: string, port: number): Promise<void> {
    const mainScript = path.join(backendPath, 'main.py')
    const pythonPath = this.config.pythonPath || 'python'

    this.process = spawn(pythonPath, [mainScript], {
      cwd: backendPath,
      env: {
        ...process.env,
        PORT: port.toString(),
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    this.setupProcessHandlers()
    return this.waitForStartup()
  }

  private startConda(backendPath: string, port: number): Promise<void> {
    const mainScript = path.join(backendPath, 'main.py')
    const condaEnv = this.config.condaEnv

    // conda run -n env_name python main.py
    const args = condaEnv
      ? ['run', '-n', condaEnv, 'python', mainScript]
      : ['run', 'python', mainScript]

    this.process = spawn('conda', args, {
      cwd: backendPath,
      env: {
        ...process.env,
        PORT: port.toString(),
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    this.setupProcessHandlers()
    return this.waitForStartup()
  }

  private startExe(backendPath: string, port: number): Promise<void> {
    const exePath = this.config.pythonPath || path.join(backendPath, 'backend.exe')

    this.process = spawn(exePath, [], {
      cwd: backendPath,
      env: {
        ...process.env,
        PORT: port.toString()
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    this.setupProcessHandlers()
    return this.waitForStartup()
  }

  private setupProcessHandlers(): void {
    this.process?.stdout?.on('data', (data: Buffer): void => {
      console.log(`[Python] ${data.toString('utf-8')}`)
    })

    this.process?.stderr?.on('data', (data: Buffer): void => {
      console.error(`[Python Error] ${data.toString('utf-8')}`)
    })

    this.process?.on('error', (err: Error): void => {
      console.error('Python process error:', err)
    })

    this.process?.on('exit', (code: number | null): void => {
      console.log(`Python process exited with code ${code}`)
    })
  }

  private waitForStartup(): Promise<void> {
    return new Promise<void>((resolve): void => {
      setTimeout(resolve, 2000)
    })
  }

  stop(): void {
    if (this.process) {
      const pid = this.process.pid
      console.log(`[Python] Stopping process with PID: ${pid}`)

      // Windows 上使用 taskkill 强制终止进程树（同步执行）
      if (process.platform === 'win32' && pid) {
        try {
          // /f 强制终止，/t 终止进程树（包括子进程）
          execSync(`taskkill /pid ${pid} /f /t`, { timeout: 5000 })
          console.log(`[Python] Successfully killed process tree with PID: ${pid}`)
        } catch (err) {
          console.warn('[Python] taskkill failed:', err)
          // 备用方案：尝试通过进程名终止可能的残留进程
          try {
            // 终止可能的 uvicorn/Python 进程（按命令行特征）
            execSync(`wmic process where "CommandLine like '%main.py%'" call terminate`, { timeout: 5000 })
            console.log('[Python] Terminated processes running main.py')
          } catch (wmicErr) {
            console.warn('[Python] wmic terminate failed:', wmicErr)
          }
          // 最后备用
          try {
            this.process.kill('SIGKILL')
          } catch (killErr) {
            console.warn('[Python] SIGKILL also failed:', killErr)
          }
        }
      } else {
        // 非 Windows 系统使用 SIGTERM + SIGKILL
        try {
          this.process.kill('SIGTERM')
        } catch (err) {
          console.warn('[Python] SIGTERM failed:', err)
        }
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            try {
              this.process.kill('SIGKILL')
              console.log('[Python] Force killed with SIGKILL')
            } catch (err) {
              console.warn('[Python] SIGKILL failed:', err)
            }
          }
        }, 1000)
      }

      this.process = null
    }
  }
}

export default PythonProcessManager
export { StartupConfig, DEFAULT_CONFIG }