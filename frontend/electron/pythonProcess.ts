import { spawn, ChildProcess } from 'child_process'
import path from 'path'

class PythonProcessManager {
  private process: ChildProcess | null = null
  private port: number = 8000

  start(pythonPath: string, backendPath: string): Promise<void> {
    // 如果是打包后的 exe，直接运行 backend.exe
    // 如果是开发模式，运行 python main.py
    const isExe = pythonPath.endsWith('.exe')

    if (isExe) {
      // 打包模式：直接运行 backend.exe
      this.process = spawn(pythonPath, [], {
        cwd: backendPath,
        env: {
          ...process.env,
          PORT: this.port.toString(),
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1'
        },
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } else {
      // 开发模式：运行 python main.py
      const mainScript: string = path.join(backendPath, 'main.py')
      this.process = spawn(pythonPath, [mainScript], {
        cwd: backendPath,
        env: {
          ...process.env,
          PORT: this.port.toString(),
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1'
        },
        stdio: ['ignore', 'pipe', 'pipe']
      })
    }

    this.process.stdout?.on('data', (data: Buffer): void => {
      console.log(`[Python] ${data.toString('utf-8')}`)
    })

    this.process.stderr?.on('data', (data: Buffer): void => {
      console.error(`[Python Error] ${data.toString('utf-8')}`)
    })

    this.process.on('error', (err: Error): void => {
      console.error('Python process error:', err)
    })

    this.process.on('exit', (code: number | null): void => {
      console.log(`Python process exited with code ${code}`)
    })

    return new Promise<void>((resolve): void => {
      setTimeout(resolve, 2000)
    })
  }

  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM')
      this.process = null
    }
  }
}

export default PythonProcessManager