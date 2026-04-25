const { spawn } = require('child_process')
const path = require('path')

class PythonProcessManager {
  constructor() {
    this.process = null
    this.port = 8000
  }

  start(pythonPath, backendPath) {
    const mainScript = path.join(backendPath, 'main.py')

    this.process = spawn(pythonPath, [mainScript], {
      cwd: backendPath,
      env: {
        ...process.env,
        PORT: this.port.toString()
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    this.process.stdout.on('data', (data) => {
      console.log(`[Python] ${data}`)
    })

    this.process.stderr.on('data', (data) => {
      console.error(`[Python Error] ${data}`)
    })

    this.process.on('error', (err) => {
      console.error('Python process error:', err)
    })

    this.process.on('exit', (code) => {
      console.log(`Python process exited with code ${code}`)
    })

    return new Promise((resolve) => {
      setTimeout(resolve, 2000)
    })
  }

  stop() {
    if (this.process) {
      this.process.kill('SIGTERM')
      this.process = null
    }
  }
}

module.exports = PythonProcessManager