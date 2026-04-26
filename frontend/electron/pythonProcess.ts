import { spawn, ChildProcess } from 'child_process'
import path from 'path'

class PythonProcessManager {
  private process: ChildProcess | null = null
  private port: number = 8000

  start(pythonPath: string, backendPath: string): Promise<void> {
    const mainScript: string = path.join(backendPath, 'main.py')

    this.process = spawn(pythonPath, [mainScript], {
      cwd: backendPath,
      env: {
        ...process.env,
        PORT: this.port.toString()
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    this.process.stdout?.on('data', (data: Buffer): void => {
      console.log(`[Python] ${data}`)
    })

    this.process.stderr?.on('data', (data: Buffer): void => {
      console.error(`[Python Error] ${data}`)
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