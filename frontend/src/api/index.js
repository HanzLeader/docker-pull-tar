import axios from 'axios'

const API_BASE_URL = 'http://127.0.0.1:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const settingsApi = {
  get: () => api.get('/api/settings'),
  update: (data) => api.post('/api/settings', data)
}

export const mirrorsApi = {
  list: () => api.get('/api/mirrors'),
  add: (data) => api.post('/api/mirrors', data),
  update: (id, data) => api.put(`/api/mirrors/${id}`, data),
  delete: (id) => api.delete(`/api/mirrors/${id}`),
  setDefault: (id) => api.post(`/api/mirrors/${id}/default`)
}

export const historyApi = {
  list: () => api.get('/api/history'),
  delete: (id) => api.delete(`/api/history/${id}`),
  clear: () => api.delete('/api/history')
}

export const downloadApi = {
  start: (data) => api.post('/api/download/start', data),
  cancel: () => api.post('/api/download/cancel'),
  status: () => api.get('/api/download/status')
}

export default api