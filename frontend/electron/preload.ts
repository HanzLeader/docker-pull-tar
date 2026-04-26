import { contextBridge, ipcRenderer } from 'electron'

interface ElectronAPI {
  selectDirectory: () => Promise<string | null>
  openDirectory: (path: string) => Promise<void>
}

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('select-directory'),
  openDirectory: (path: string): Promise<void> => ipcRenderer.invoke('open-directory', path)
} satisfies ElectronAPI)