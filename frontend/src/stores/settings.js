import { defineStore } from 'pinia'
import { settingsApi, mirrorsApi } from '@/api'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
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
    async loadSettings() {
      this.loading = true
      try {
        const [settingsRes, mirrorsRes] = await Promise.all([
          settingsApi.get(),
          mirrorsApi.list()
        ])
        this.settings = settingsRes.data
        this.mirrors = mirrorsRes.data
      } finally {
        this.loading = false
      }
    },

    async updateSettings(data) {
      const res = await settingsApi.update(data)
      this.settings = res.data
    },

    async addMirror(mirror) {
      const res = await mirrorsApi.add(mirror)
      this.mirrors.push(res.data)
    },

    async deleteMirror(id) {
      await mirrorsApi.delete(id)
      this.mirrors = this.mirrors.filter(m => m.id !== id)
    },

    async setDefaultMirror(id) {
      await mirrorsApi.setDefault(id)
      await this.loadSettings()
    },

    getDefaultMirrorRegistry() {
      const defaultMirror = this.mirrors.find(m => m.isDefault)
      return defaultMirror?.registry || 'docker.1ms.run'
    }
  }
})