<template>
  <div class="download-progress" v-if="status !== 'idle'">
    <div class="progress-header">
      <span class="progress-title">📊 下载进度</span>
      <span class="progress-status">{{ statusText }}</span>
    </div>
    <div class="progress-layers">
      <div v-for="(layer, index) in layers" :key="index" class="layer-item">
        <div class="layer-header">
          <span class="layer-status-icon">{{ layer.completed ? '✅' : layer.downloading ? '⬇️' : '⏳' }}</span>
          <span class="layer-name">{{ layer.name }}</span>
        </div>
        <el-progress
          :percentage="layer.percentage"
          :status="layer.completed ? 'success' : ''"
          :stroke-width="10"
        />
        <div class="layer-info">
          <span>{{ formatSize(layer.downloaded) }}/{{ formatSize(layer.total) }}</span>
        </div>
      </div>
    </div>
    <div class="progress-summary">
      <span>速度: {{ formatSpeed(speed) }}</span>
      <span>总计: {{ currentLayer }}/{{ totalLayers }} 层</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useDownloadStore } from '@/stores/download'

const downloadStore = useDownloadStore()

const status = downloadStore.status
const progress = downloadStore.progress

const statusText = computed(() => {
  const texts = {
    idle: '空闲',
    preparing: '准备中',
    downloading: '下载中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  }
  return texts[status] || '未知'
})

const layers = computed(() => progress.layers || [])
const currentLayer = computed(() => progress.currentLayer || 0)
const totalLayers = computed(() => progress.totalLayers || 0)
const speed = computed(() => progress.speed || 0)

const formatSize = (bytes) => {
  if (!bytes) return '0B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  for (const unit of units) {
    if (size < 1024) return `${size.toFixed(1)}${unit}`
    size /= 1024
  }
  return `${size.toFixed(1)}TB`
}

const formatSpeed = (bytesPerSec) => {
  return formatSize(bytesPerSec) + '/s'
}
</script>

<style scoped>
.download-progress {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  margin-top: 16px;
  border: 1px solid #e4e7ed;
}
.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}
.progress-title {
  font-weight: bold;
}
.progress-status {
  color: #409eff;
}
.progress-layers {
  max-height: 150px;
  overflow-y: auto;
}
.layer-item {
  margin-bottom: 8px;
}
.layer-header {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}
.layer-status-icon {
  margin-right: 6px;
}
.layer-name {
  font-size: 12px;
  color: #606266;
}
.layer-info {
  font-size: 12px;
  color: #909399;
  text-align: right;
}
.progress-summary {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: #606266;
}
</style>