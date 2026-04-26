/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// Electron API exposed via contextBridge
interface ElectronAPI {
  selectDirectory: () => Promise<string | null>
  openDirectory: (path: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI | undefined
  }
}

export {}