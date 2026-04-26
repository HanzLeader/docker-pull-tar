import axios from 'axios'
import type { AxiosInstance, AxiosResponse } from 'axios'
import type { AppSettings, Mirror, HistoryItem, DownloadStartRequest, DownloadProgress, DownloadStatus } from '@/types/api'

const API_BASE_URL = 'http://127.0.0.1:8000'

// 普通请求 API（30秒超时）
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 下载相关 API（无超时，因为下载可能需要很长时间）
const downloadApiInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 0, // 无超时
  headers: {
    'Content-Type': 'application/json'
  }
})

export const settingsApi = {
  get: (): Promise<AxiosResponse<AppSettings>> => api.get<AppSettings>('/api/settings'),
  update: (data: Partial<AppSettings>): Promise<AxiosResponse<AppSettings>> => api.post<AppSettings>('/api/settings', data)
}

export const mirrorsApi = {
  list: (): Promise<AxiosResponse<Mirror[]>> => api.get<Mirror[]>('/api/mirrors'),
  add: (data: Omit<Mirror, 'id'>): Promise<AxiosResponse<Mirror>> => api.post<Mirror>('/api/mirrors', data),
  update: (id: string, data: Mirror): Promise<AxiosResponse<Mirror>> => api.put<Mirror>(`/api/mirrors/${id}`, data),
  delete: (id: string): Promise<AxiosResponse<void>> => api.delete<void>(`/api/mirrors/${id}`),
  setDefault: (id: string): Promise<AxiosResponse<void>> => api.post<void>(`/api/mirrors/${id}/default`)
}

export const historyApi = {
  list: (): Promise<AxiosResponse<HistoryItem[]>> => api.get<HistoryItem[]>('/api/history'),
  delete: (id: string): Promise<AxiosResponse<void>> => api.delete<void>(`/api/history/${id}`),
  clear: (): Promise<AxiosResponse<void>> => api.delete<void>('/api/history')
}

export const downloadApi = {
  start: (data: DownloadStartRequest): Promise<AxiosResponse<{ status: string; packageName: string; authEnabled: boolean }>> =>
    downloadApiInstance.post<{ status: string; packageName: string; authEnabled: boolean }>('/api/download/start', data),
  cancel: (): Promise<AxiosResponse<{ status: string }>> => downloadApiInstance.post<{ status: string }>('/api/download/cancel'),
  status: (): Promise<AxiosResponse<DownloadProgress & { status: DownloadStatus; packageName: string }>> =>
    api.get<DownloadProgress & { status: DownloadStatus; packageName: string }>('/api/download/status')
}

export default api