import { defineStore } from 'pinia'
import { downloadApi } from '@/api'
import { parseImageInput } from '@/utils/imageParser'

export const useDownloadStore = defineStore('download', {
  state: () => ({
    status: 'idle',
    packageName: '',
    tag: 'latest',
    arch: 'amd64',
    mirror: '',
    outputDir: '',
    progress: {
      currentLayer: 0,
      totalLayers: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      layers: []
    },
    logs: [],
    wsConnection: null
  }),

  actions: {
    async startDownload(packageName, settingsStore) {
      const mirrorRegistry = settingsStore.getDefaultMirrorRegistry()
      const parsed = parseImageInput(packageName, mirrorRegistry)

      if (!parsed) {
        throw new Error('请输入有效的镜像包名')
      }

      this.packageName = parsed.packageName
      this.tag = parsed.tag
      this.mirror = parsed.registry
      this.arch = settingsStore.settings.defaultArch
      this.outputDir = settingsStore.settings.defaultOutputDir

      const res = await downloadApi.start({
        packageName: parsed.packageName,
        tag: parsed.tag,
        arch: this.arch,
        mirror: parsed.registry,
        outputDir: this.outputDir,
        username: settingsStore.settings.registryUsername || null,
        password: settingsStore.settings.registryPassword || null
      })

      this.status = 'downloading'
      return res.data
    },

    async cancelDownload() {
      await downloadApi.cancel()
      this.status = 'idle'
    },

    async checkStatus() {
      const res = await downloadApi.status()
      this.status = res.data.status
      this.progress = res.data
    },

    addLog(log) {
      this.logs.push({
        level: log.level,
        message: log.message,
        timestamp: log.timestamp
      })
    },

    clearLogs() {
      this.logs = []
    },

    connectWebSocket(port = 8000) {
      if (this.wsConnection) {
        this.wsConnection.close()
      }

      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/logs`)

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'log') {
          this.addLog(data)
        } else if (data.type === 'progress') {
          this.progress = data
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      this.wsConnection = ws
    },

    disconnectWebSocket() {
      if (this.wsConnection) {
        this.wsConnection.close()
        this.wsConnection = null
      }
    }
  }
})