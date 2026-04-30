<template>
  <div class="home-page">
    <el-card class="download-card">
      <el-form :model="form" label-width="100px">
        <el-form-item label="镜像包名">
          <el-input
            v-model="form.packageName"
            placeholder="例如: nginx, nginx:latest"
            :disabled="isDownloading"
          >
            <template #append>
              <el-button @click="parseAndPreview" :disabled="isDownloading">解析</el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="镜像源">
          <MirrorSelector v-model="form.mirror" :disabled="isDownloading" />
        </el-form-item>

        <el-form-item label="架构">
          <el-select v-model="form.arch" :disabled="isDownloading">
            <el-option label="amd64 (x86_64)" value="amd64" />
            <el-option label="arm64 (ARMv8)" value="arm64" />
            <el-option label="armv7" value="armv7" />
          </el-select>
        </el-form-item>

        <el-form-item label="输出目录">
          <el-input v-model="form.outputDir" :disabled="isDownloading">
            <template #append>
              <el-button @click="selectOutputDir" :disabled="isDownloading">选择</el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            @click="startDownload"
            :loading="isDownloading"
            :disabled="!form.packageName"
          >
            {{ isDownloading ? '下载中...' : '开始下载' }}
          </el-button>
          <el-button
            size="large"
            @click="cancelDownload"
            :disabled="!isDownloading"
          >
            取消
          </el-button>
        </el-form-item>
      </el-form>

      <LogConsole />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'
import { useDownloadStore } from '@/stores/download'
import { parseImageInput } from '@/utils/imageParser'
import MirrorSelector from '@/components/MirrorSelector.vue'
import LogConsole from '@/components/LogConsole.vue'

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()
const downloadStore = useDownloadStore()

interface FormState {
  packageName: string
  mirror: string
  arch: string
  outputDir: string
}

const form = ref<FormState>({
  packageName: '',
  mirror: '',
  arch: 'amd64',
  outputDir: ''
})

const isDownloading = computed<boolean>(() => downloadStore.status === 'downloading' || downloadStore.status === 'preparing')

onMounted(async () => {
  console.log('Home page mounted, loading settings...')
  try {
    await settingsStore.loadSettings()
    form.value.arch = settingsStore.settings.defaultArch
    form.value.outputDir = settingsStore.settings.defaultOutputDir
    form.value.mirror = settingsStore.getDefaultMirrorRegistry()
    form.value.packageName = settingsStore.settings.lastPackageName || ''

    // 处理重新下载参数
    if (route.query.redownload) {
      const packageName = route.query.packageName as string
      const tag = route.query.tag as string
      const arch = route.query.arch as string
      const mirror = route.query.mirror as string

      if (packageName) {
        // 拼接完整镜像包名
        form.value.packageName = tag ? `${packageName}:${tag}` : packageName
      }
      if (arch) {
        form.value.arch = arch
      }
      if (mirror) {
        // 检查镜像源是否存在
        const mirrorExists = settingsStore.mirrors.some(m => m.registry === mirror)
        form.value.mirror = mirrorExists ? mirror : settingsStore.getDefaultMirrorRegistry()
      }

      // 清除 query 参数，避免刷新页面时重复填充
      router.replace({ path: '/' })
    }

    console.log('Settings loaded:', form.value)
    downloadStore.connectWebSocket()
    downloadStore.startPolling()
  } catch (error) {
    console.error('Failed to load settings on mount:', error)
    ElMessage.error('加载配置失败，请检查后端服务是否启动')
    // 使用默认值
    form.value.arch = 'amd64'
    form.value.outputDir = ''
    form.value.mirror = 'docker.1ms.run'
    form.value.packageName = ''
  }
})

onUnmounted(() => {
  downloadStore.disconnectWebSocket()
})

const parseAndPreview = () => {
  if (!form.value.packageName) {
    ElMessage.warning('请输入镜像包名')
    return
  }
  const parsed = parseImageInput(form.value.packageName, form.value.mirror)
  if (parsed) {
    ElMessage.success(`完整镜像地址: ${parsed.fullImage}`)
  }
}

const startDownload = async () => {
  if (!form.value.packageName) {
    ElMessage.warning('请输入镜像包名')
    return
  }

  if (!form.value.outputDir) {
    ElMessage.warning('请选择输出目录')
    return
  }

  // 保存选择的目录和包名到 settings（持久化）
  if (form.value.outputDir !== settingsStore.settings.defaultOutputDir || form.value.packageName !== settingsStore.settings.lastPackageName) {
    await settingsStore.updateSettings({
      defaultOutputDir: form.value.outputDir,
      lastPackageName: form.value.packageName
    })
  }

  try {
    // 传递用户在页面上选择的镜像源和架构，而不是默认配置
    await downloadStore.startDownload(form.value.packageName, form.value.outputDir, form.value.mirror, form.value.arch, settingsStore)
    ElMessage.success('开始下载')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '下载失败'
    ElMessage.error(message)
  }
}

const cancelDownload = async () => {
  try {
    await downloadStore.cancelDownload()
    ElMessage.info('下载已取消')
  } catch (error) {
    ElMessage.error('取消失败')
  }
}

const selectOutputDir = async () => {
  if (window.electronAPI?.selectDirectory) {
    const path = await window.electronAPI.selectDirectory()
    if (path) {
      form.value.outputDir = path
      // 自动保存到 settings（持久化），同时保存当前包名
      await settingsStore.updateSettings({
        defaultOutputDir: path,
        lastPackageName: form.value.packageName
      })
      ElMessage.success('输出目录已保存')
    }
  } else {
    ElMessage.info('请在设置中配置默认输出目录')
  }
}
</script>

<style scoped>
.home-page {
  padding: 20px;
  max-width: 960px;
  margin: 0 auto;
}
.download-card {
  height: 92%;
}
</style>