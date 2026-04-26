<template>
  <div class="history-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>下载历史</span>
          <el-button type="danger" size="small" @click="clearHistory" :disabled="history.length === 0">
            清空历史
          </el-button>
        </div>
      </template>

      <el-empty v-if="history.length === 0" description="暂无下载历史" />

      <div v-else class="history-list">
        <div v-for="item in history" :key="item.id" class="history-item">
          <div class="item-header">
            <span class="item-status" :class="item.status">
              {{ item.status === 'completed' ? '完成' : item.status === 'failed' ? '失败' : '等待' }}
            </span>
            <span class="item-name">{{ item.packageName }}:{{ item.tag }}</span>
            <span class="item-arch">({{ item.arch }})</span>
          </div>
          <div class="item-details">
            <div class="detail-row">
              <span class="detail-label">镜像源:</span>
              <span class="detail-value">{{ item.mirror }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">完整地址:</span>
              <span class="detail-value">{{ item.fullImage }}</span>
            </div>
            <div v-if="item.outputPath" class="detail-row">
              <span class="detail-label">输出路径:</span>
              <span class="detail-value">{{ item.outputPath }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">大小:</span>
              <span class="detail-value">{{ item.size || '未知' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">时间:</span>
              <span class="detail-value">{{ formatTime(item.downloadedAt) }}</span>
            </div>
            <div v-if="item.error" class="detail-row error">
              <span class="detail-label">错误:</span>
              <span class="detail-value">{{ item.error }}</span>
            </div>
          </div>
          <div class="item-actions">
            <el-button size="small" @click="redownload(item)">重新下载</el-button>
            <el-button v-if="item.outputPath" size="small" @click="openDirectory(item.outputPath)">打开目录</el-button>
            <el-button type="danger" size="small" @click="deleteHistory(item.id)">删除</el-button>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { historyApi } from '@/api'
import type { HistoryItem } from '@/types/api'

const history = ref<HistoryItem[]>([])

onMounted(async () => {
  await loadHistory()
})

const loadHistory = async () => {
  try {
    const res = await historyApi.list()
    history.value = res.data
  } catch (error) {
    ElMessage.error('加载历史记录失败')
  }
}

const clearHistory = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有历史记录吗？', '警告', {
      type: 'warning'
    })
    await historyApi.clear()
    history.value = []
    ElMessage.success('历史记录已清空')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清空失败')
    }
  }
}

const deleteHistory = async (id: string): Promise<void> => {
  try {
    await historyApi.delete(id)
    history.value = history.value.filter((h: HistoryItem) => h.id !== id)
    ElMessage.success('已删除')
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

const redownload = (_item: HistoryItem): void => {
  ElMessage.info('重新下载功能待实现')
}

const openDirectory = async (path: string): Promise<void> => {
  if (window.electronAPI?.openDirectory) {
    await window.electronAPI.openDirectory(path)
  } else {
    ElMessage.info('请在文件管理器中打开: ' + path)
  }
}

const formatTime = (timestamp: string | null): string => {
  if (!timestamp) return '未知'
  return new Date(timestamp).toLocaleString('zh-CN')
}
</script>

<style scoped>
.history-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.history-list {
  max-height: 500px;
  overflow-y: auto;
}
.history-item {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
.item-header {
  font-weight: bold;
  margin-bottom: 8px;
}
.item-status.completed {
  color: #67c23a;
}
.item-status.failed {
  color: #f56c6c;
}
.item-arch {
  color: #909399;
  margin-left: 8px;
}
.item-details {
  margin-bottom: 8px;
}
.detail-row {
  display: flex;
  margin-bottom: 4px;
  font-size: 13px;
}
.detail-label {
  color: #909399;
  width: 80px;
}
.detail-value {
  color: #606266;
}
.detail-row.error .detail-value {
  color: #f56c6c;
}
.item-actions {
  display: flex;
  gap: 8px;
}
</style>