import { defineStore } from 'pinia'
import { settingsApi, mirrorsApi } from '@/api'
import type { AppSettings, Mirror } from '@/types/api'

interface SettingsState {
  settings: AppSettings
  mirrors: Mirror[]
  loading: boolean
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    settings: {
      defaultOutputDir: '',
      defaultArch: 'amd64',
      defaultMirror: 'docker.1ms.run',
      downloadWorkers: 4
    },
    mirrors: [],
    loading: false
  }),

  actions: {
    async loadSettings(): Promise<void> {
      this.loading = true
      try {
        const [settingsRes, mirrorsRes] = await Promise.all([
          settingsApi.get(),
          mirrorsApi.list()
        ])
        this.settings = settingsRes.data
        this.mirrors = mirrorsRes.data
        console.log('Settings loaded:', this.settings)
        console.log('Mirrors loaded:', this.mirrors.length)
      } catch (error) {
        console.error('Failed to load settings:', error)
        // 设置默认值防止页面崩溃
        this.settings = {
          defaultOutputDir: '',
          defaultArch: 'amd64',
          defaultMirror: 'docker.1ms.run',
          downloadWorkers: 4
        }
        this.mirrors = []
      } finally {
        this.loading = false
      }
    },

    async updateSettings(data: Partial<AppSettings>): Promise<void> {
      const res = await settingsApi.update(data)
      this.settings = res.data
    },

    async addMirror(mirror: Omit<Mirror, 'id'>): Promise<void> {
      const res = await mirrorsApi.add(mirror)
      this.mirrors.push(res.data)
    },

    async updateMirror(id: string, mirror: Mirror): Promise<void> {
      const res = await mirrorsApi.update(id, mirror)
      const index = this.mirrors.findIndex((m: Mirror) => m.id === id)
      if (index !== -1) {
        this.mirrors[index] = res.data
      }
    },

    async deleteMirror(id: string): Promise<void> {
      await mirrorsApi.delete(id)
      this.mirrors = this.mirrors.filter((m: Mirror) => m.id !== id)
    },

    async setDefaultMirror(id: string): Promise<void> {
      await mirrorsApi.setDefault(id)
      await this.loadSettings()
    },

    getDefaultMirrorRegistry(): string {
      const defaultMirror = this.mirrors.find((m: Mirror) => m.isDefault)
      return defaultMirror?.registry || 'docker.1ms.run'
    },

    getDefaultMirror(): Mirror | undefined {
      return this.mirrors.find((m: Mirror) => m.isDefault) || this.mirrors[0]
    },

    getMirrorByRegistry(registry: string): Mirror | undefined {
      return this.mirrors.find((m: Mirror) => m.registry === registry)
    },

    getMirrorCredentials(registry: string): { username: string | null; password: string | null } {
      const mirror = this.getMirrorByRegistry(registry)
      return {
        username: mirror?.username || null,
        password: mirror?.password || null
      }
    }
  }
})