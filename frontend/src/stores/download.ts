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
  wsConnected: boolean
  wsReconnectAttempts: number
}

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 2000

// 辅助函数：格式化字节大小
function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  for (const unit of units) {
    if (size < 1024) return `${size.toFixed(1)}${unit}`
    size /= 1024
  }
  return `${size.toFixed(1)}TB`
}

// 辅助函数：格式化速度
function formatSpeed(bytesPerSec: number): string {
  return formatSize(bytesPerSec) + '/s'
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
    wsConnection: null,
    wsConnected: false,
    wsReconnectAttempts: 0
  }),

  actions: {
    async startDownload(packageName: string, outputDir: string, mirror: string, arch: string, settingsStore: ReturnType<typeof useSettingsStore>): Promise<{ status: string; packageName: string; authEnabled: boolean }> {
      // 使用用户在页面上选择的镜像源，而不是默认配置
      const parsed: ParsedImage | null = parseImageInput(packageName, mirror)

      if (!parsed) {
        throw new Error('请输入有效的镜像包名')
      }

      // 确保 WebSocket 已连接
      if (!this.wsConnected) {
        this.connectWebSocket()
        // 等待连接建立
        await new Promise<void>((resolve) => {
          const checkConnection = (): void => {
            if (this.wsConnected) {
              resolve()
            } else if (this.wsReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
              resolve() // 即使没连上也继续，至少能通过 API 获取状态
            } else {
              setTimeout(checkConnection, 100)
            }
          }
          checkConnection()
        })
      }

      this.packageName = parsed.packageName
      this.tag = parsed.tag
      this.mirror = mirror  // 使用用户选择的镜像源
      this.arch = arch  // 使用用户选择的架构
      this.outputDir = outputDir  // 使用用户选择的输出目录

      // 使用用户选择的镜像源获取认证信息
      const credentials = settingsStore.getMirrorCredentials(mirror)

      // 设置为准备状态
      this.status = 'preparing'

      // 发送下载请求（后台异步执行，不等待完成）
      const res = await downloadApi.start({
        packageName: parsed.repository,
        tag: parsed.tag,
        arch: this.arch,
        mirror: mirror,  // 使用用户选择的镜像源
        outputDir: this.outputDir,
        username: credentials.username,
        password: credentials.password
      })

      // 下载已在后台启动，通过 WebSocket 获取实时状态
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

      // 如果下载完成或失败，更新进度
      if (this.status === 'completed' || this.status === 'failed' || this.status === 'cancelled') {
        this.progress = {
          currentLayer: res.data.currentLayer,
          totalLayers: res.data.totalLayers,
          downloadedBytes: res.data.downloadedBytes,
          totalBytes: res.data.totalBytes,
          speed: res.data.speed,
          layers: res.data.layers || []
        }
      }
    },

    addLog(log: WebSocketLogMessage): void {
      this.logs.push({
        type: 'log',
        level: log.level,
        message: log.message,
        timestamp: log.timestamp
      })
      // 限制日志数量，防止内存过大
      if (this.logs.length > 500) {
        this.logs = this.logs.slice(-500)
      }
    },

    clearLogs(): void {
      this.logs = []
    },

    connectWebSocket(port: number = 8000): void {
      if (this.wsConnection) {
        this.wsConnection.close()
      }

      const wsUrl = `ws://127.0.0.1:${port}/ws/logs`

      const connect = (): void => {
        const ws = new WebSocket(wsUrl)

        ws.onopen = (): void => {
          this.wsConnected = true
          this.wsReconnectAttempts = 0
          console.log('WebSocket connected')
          // 添加连接成功日志
          this.addLog({
            type: 'log',
            level: 'info',
            message: '实时日志连接已建立',
            timestamp: new Date().toISOString()
          })
        }

        ws.onmessage = (event: MessageEvent): void => {
          console.log('WebSocket message received:', event.data)
          try {
            const data: WebSocketMessage = JSON.parse(event.data)
            console.log('Parsed message:', data.type, data)
            if (data.type === 'log') {
              this.addLog(data as WebSocketLogMessage)
            } else if (data.type === 'progress') {
              const progressData = data as DownloadProgress
              this.progress = progressData

              // 在控制台显示下载进度
              if (progressData.currentLayer > 0 && progressData.totalLayers > 0) {
                const speedStr = formatSpeed(progressData.speed)
                const percent = progressData.totalBytes > 0
                  ? Math.round((progressData.downloadedBytes / progressData.totalBytes) * 100)
                  : 0

                // 添加进度日志
                this.addLog({
                  type: 'log',
                  level: 'info',
                  message: `📊 进度: ${progressData.currentLayer}/${progressData.totalLayers} 层 | ${percent}% | 速度: ${speedStr}`,
                  timestamp: new Date().toISOString()
                })
              }

              // 检查各层状态变化
              for (const layer of progressData.layers || []) {
                if (layer.status === 'completed') {
                  // 层完成时添加日志
                  const existingLog = this.logs.find(l =>
                    l.message.includes(`✅ Layer`) && l.message.includes(layer.digest.substring(0, 12))
                  )
                  if (!existingLog) {
                    this.addLog({
                      type: 'log',
                      level: 'success',
                      message: `✅ Layer ${layer.digest.substring(0, 12)} 完成`,
                      timestamp: new Date().toISOString()
                    })
                  }
                }
              }

              // 根据层数据判断下载状态
              const allCompleted = progressData.layers?.every(l => l.status === 'completed')
              const anyFailed = progressData.layers?.some(l => l.status === 'failed')
              if (allCompleted && progressData.totalLayers > 0) {
                this.status = 'completed'
                this.addLog({
                  type: 'log',
                  level: 'success',
                  message: '🎉 所有层下载完成！',
                  timestamp: new Date().toISOString()
                })
              } else if (anyFailed) {
                this.status = 'failed'
              }
            }
          } catch (e) {
            console.error('WebSocket message parse error:', e)
          }
        }

        ws.onerror = (error: Event): void => {
          console.error('WebSocket error:', error)
          this.wsConnected = false
          this.addLog({
            type: 'log',
            level: 'error',
            message: '实时日志连接错误',
            timestamp: new Date().toISOString()
          })
        }

        ws.onclose = (): void => {
          this.wsConnected = false
          console.log('WebSocket closed')

          // 如果正在下载且连接断开，尝试重连
          if (this.status === 'downloading' || this.status === 'preparing') {
            this.wsReconnectAttempts++
            if (this.wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              this.addLog({
                type: 'log',
                level: 'warning',
                message: `连接断开，正在重连 (${this.wsReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`,
                timestamp: new Date().toISOString()
              })
              setTimeout(connect, RECONNECT_DELAY)
            } else {
              this.addLog({
                type: 'log',
                level: 'error',
                message: '重连失败，请刷新页面',
                timestamp: new Date().toISOString()
              })
            }
          }
        }

        this.wsConnection = ws
      }

      connect()
    },

    disconnectWebSocket(): void {
      if (this.wsConnection) {
        this.wsConnection.close()
        this.wsConnection = null
        this.wsConnected = false
      }
    },

    // 轮询同步状态（作为 WebSocket 失败时的备用方案）
    startPolling(): void {
      const pollInterval = setInterval(() => {
        if (this.status === 'downloading' || this.status === 'preparing') {
          this.checkStatus().catch((e: Error) => {
            console.error('Status polling error:', e)
          })
        } else {
          clearInterval(pollInterval)
        }
      }, 3000) // 每 3 秒轮询一次
    }
  }
})