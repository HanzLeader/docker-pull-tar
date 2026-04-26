import { defineStore } from 'pinia'
import { downloadApi } from '@/api'
import { parseImageInput } from '@/utils/imageParser'
import type { ParsedImage } from '@/utils/imageParser'
import type { DownloadProgress, DownloadStatus, WebSocketLogMessage, WebSocketMessage } from '@/types/api'
import type { useSettingsStore } from './settings'

interface DownloadState {
  status: DownloadStatus
  packageName: string
  tag: string
  arch: string
  mirror: string
  outputDir: string
  progress: DownloadProgress
  logs: WebSocketLogMessage[]
  wsConnection: WebSocket | null
}

export const useDownloadStore = defineStore('download', {
  state: (): DownloadState => ({
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
    async startDownload(packageName: string, settingsStore: ReturnType<typeof useSettingsStore>): Promise<{ status: string; packageName: string; authEnabled: boolean }> {
      const mirrorRegistry = settingsStore.getDefaultMirrorRegistry()
      const parsed: ParsedImage | null = parseImageInput(packageName, mirrorRegistry)

      if (!parsed) {
        throw new Error('请输入有效的镜像包名')
      }

      this.packageName = parsed.packageName
      this.tag = parsed.tag
      this.mirror = parsed.registry
      this.arch = settingsStore.settings.defaultArch
      this.outputDir = settingsStore.settings.defaultOutputDir

      const credentials = settingsStore.getMirrorCredentials(parsed.registry)

      const res = await downloadApi.start({
        packageName: parsed.repository,
        tag: parsed.tag,
        arch: this.arch,
        mirror: parsed.registry,
        outputDir: this.outputDir,
        username: credentials.username,
        password: credentials.password
      })

      this.status = 'downloading'
      return res.data
    },

    async cancelDownload(): Promise<void> {
      await downloadApi.cancel()
      this.status = 'idle'
    },

    async checkStatus(): Promise<void> {
      const res = await downloadApi.status()
      this.status = res.data.status
      this.progress = res.data
    },

    addLog(log: WebSocketLogMessage): void {
      this.logs.push({
        type: 'log',
        level: log.level,
        message: log.message,
        timestamp: log.timestamp
      })
    },

    clearLogs(): void {
      this.logs = []
    },

    connectWebSocket(port: number = 8000): void {
      if (this.wsConnection) {
        this.wsConnection.close()
      }

      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/logs`)

      ws.onmessage = (event: MessageEvent): void => {
        const data: WebSocketMessage = JSON.parse(event.data)
        if (data.type === 'log') {
          this.addLog(data as WebSocketLogMessage)
        } else if (data.type === 'progress') {
          this.progress = data as DownloadProgress
        }
      }

      ws.onerror = (error: Event): void => {
        console.error('WebSocket error:', error)
      }

      this.wsConnection = ws
    },

    disconnectWebSocket(): void {
      if (this.wsConnection) {
        this.wsConnection.close()
        this.wsConnection = null
      }
    }
  }
})