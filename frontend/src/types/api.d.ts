// Settings types
export interface AppSettings {
  defaultOutputDir: string
  defaultArch: string
  defaultMirror: string
  downloadWorkers: number
}

export interface Mirror {
  id: string
  name: string
  registry: string
  isDefault: boolean
  username: string | null
  password: string | null
}

// Download types
export interface DownloadStartRequest {
  packageName: string
  tag: string
  arch: string
  mirror: string
  outputDir: string
  username: string | null
  password: string | null
}

export interface LayerProgress {
  digest: string
  size: number
  status: 'waiting' | 'downloading' | 'completed' | 'failed'
  downloaded: number
  total: number
}

export interface DownloadProgress {
  currentLayer: number
  totalLayers: number
  downloadedBytes: number
  totalBytes: number
  speed: number
  layers: LayerProgress[]
}

export type DownloadStatus = 'idle' | 'preparing' | 'downloading' | 'completed' | 'failed' | 'cancelled'

// History types
export interface HistoryItem {
  id: string
  packageName: string
  tag: string
  arch: string
  mirror: string
  fullImage: string
  outputPath: string | null
  size: string | null
  status: DownloadStatus
  downloadedAt: string | null
  error: string | null
}

// WebSocket message types
export interface WebSocketLogMessage {
  type: 'log'
  level: 'info' | 'warning' | 'error' | 'success'
  message: string
  timestamp: string
}

export interface WebSocketProgressMessage {
  type: 'progress'
  currentLayer: number
  totalLayers: number
  downloadedBytes: number
  totalBytes: number
  speed: number
  layers: LayerProgress[]
}

export type WebSocketMessage = WebSocketLogMessage | WebSocketProgressMessage