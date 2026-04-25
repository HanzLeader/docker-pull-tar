<template>
  <div class="home-page">
    <el-card class="download-card">
      <el-form :model="form" label-width="100px">
        <el-form-item label="镜像包名">
          <el-input
            v-model="form.packageName"
            placeholder="例如: nginx, nginx:latest, alpine:3.18"
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

      <div v-if="parsedPreview" class="parsed-preview">
        <el-alert type="info" :closable="false">
          <template #title>
            完整镜像地址: {{ parsedPreview.fullImage }}
          </template>
        </el-alert>
      </div>

      <LogConsole />
      <DownloadProgress />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'
import { useDownloadStore } from '@/stores/download'
import { parseImageInput } from '@/utils/imageParser'
import MirrorSelector from '@/components/MirrorSelector.vue'
import LogConsole from '@/components/LogConsole.vue'
import DownloadProgress from '@/components/DownloadProgress.vue'

const settingsStore = useSettingsStore()
const downloadStore = useDownloadStore()

const form = ref({
  packageName: '',
  mirror: '',
  arch: 'amd64',
  outputDir: ''
})

const parsedPreview = ref(null)

const isDownloading = computed(() => downloadStore.status === 'downloading' || downloadStore.status === 'preparing')

onMounted(async () => {
  await settingsStore.loadSettings()
  form.value.arch = settingsStore.settings.defaultArch
  form.value.outputDir = settingsStore.settings.defaultOutputDir
  form.value.mirror = settingsStore.getDefaultMirrorRegistry()
  downloadStore.connectWebSocket()
})

onUnmounted(() => {
  downloadStore.disconnectWebSocket()
})

const parseAndPreview = () => {
  if (!form.value.packageName) {
    ElMessage.warning('请输入镜像包名')
    return
  }
  parsedPreview.value = parseImageInput(form.value.packageName, form.value.mirror)
  if (parsedPreview.value) {
    ElMessage.success('解析成功')
  }
}

const startDownload = async () => {
  if (!form.value.packageName) {
    ElMessage.warning('请输入镜像包名')
    return
  }

  parsedPreview.value = parseImageInput(form.value.packageName, form.value.mirror)

  try {
    await downloadStore.startDownload(form.value.packageName, settingsStore)
    ElMessage.success('开始下载')
  } catch (error) {
    ElMessage.error(error.message || '下载失败')
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
    }
  } else {
    ElMessage.info('请在设置中配置默认输出目录')
  }
}
</script>

<style scoped>
.home-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}
.download-card {
  margin-bottom: 20px;
}
.parsed-preview {
  margin-bottom: 16px;
}
</style>