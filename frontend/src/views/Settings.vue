<template>
  <div class="settings-page">
    <el-card class="settings-card">
      <template #header>
        <span>基本设置</span>
      </template>

      <el-form :model="settings" label-width="120px">
        <el-form-item label="默认输出目录">
          <el-input v-model="settings.defaultOutputDir">
            <template #append>
              <el-button @click="selectOutputDir">选择</el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="默认架构">
          <el-select v-model="settings.defaultArch">
            <el-option label="amd64" value="amd64" />
            <el-option label="arm64" value="arm64" />
            <el-option label="armv7" value="armv7" />
          </el-select>
        </el-form-item>

        <el-form-item label="下载线程数">
          <el-slider v-model="settings.downloadWorkers" :min="1" :max="16" show-stops />
        </el-form-item>

        <el-divider content-position="left">Docker Registry 认证</el-divider>
        <el-form-item label="用户名">
          <el-input v-model="settings.registryUsername" placeholder="用于私有仓库认证" clearable />
        </el-form-item>

        <el-form-item label="密码">
          <el-input v-model="settings.registryPassword" type="password" placeholder="用于私有仓库认证" show-password clearable />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="saveSettings">保存设置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="mirrors-card">
      <template #header>
        <div class="card-header">
          <span>镜像源管理</span>
          <el-button type="primary" size="small" @click="showAddMirror">添加镜像源</el-button>
        </div>
      </template>

      <el-table :data="mirrors" style="width: 100%">
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="registry" label="地址" />
        <el-table-column label="默认">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" type="success">默认</el-tag>
            <el-button v-else size="small" @click="setDefaultMirror(row.id)">设为默认</el-button>
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button v-if="!row.isDefault" type="danger" size="small" @click="deleteMirror(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="addMirrorVisible" title="添加镜像源">
      <el-form :model="newMirror" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="newMirror.name" placeholder="例如: 自定义镜像源" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="newMirror.registry" placeholder="例如: my.registry.com" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addMirrorVisible = false">取消</el-button>
        <el-button type="primary" @click="addMirror">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

const settings = reactive({
  defaultOutputDir: '',
  defaultArch: 'amd64',
  downloadWorkers: 4,
  registryUsername: '',
  registryPassword: ''
})

const mirrors = ref([])
const addMirrorVisible = ref(false)
const newMirror = reactive({
  name: '',
  registry: ''
})

onMounted(async () => {
  await settingsStore.loadSettings()
  Object.assign(settings, settingsStore.settings)
  mirrors.value = settingsStore.mirrors
})

const saveSettings = async () => {
  try {
    await settingsStore.updateSettings(settings)
    ElMessage.success('设置已保存')
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const selectOutputDir = async () => {
  if (window.electronAPI?.selectDirectory) {
    const path = await window.electronAPI.selectDirectory()
    if (path) {
      settings.defaultOutputDir = path
    }
  }
}

const showAddMirror = () => {
  newMirror.name = ''
  newMirror.registry = ''
  addMirrorVisible.value = true
}

const addMirror = async () => {
  if (!newMirror.name || !newMirror.registry) {
    ElMessage.warning('请填写名称和地址')
    return
  }

  try {
    await settingsStore.addMirror({
      id: '',
      name: newMirror.name,
      registry: newMirror.registry,
      isDefault: false
    })
    mirrors.value = settingsStore.mirrors
    addMirrorVisible.value = false
    ElMessage.success('镜像源已添加')
  } catch (error) {
    ElMessage.error('添加失败')
  }
}

const setDefaultMirror = async (id) => {
  try {
    await settingsStore.setDefaultMirror(id)
    mirrors.value = settingsStore.mirrors
    ElMessage.success('已设为默认镜像源')
  } catch (error) {
    ElMessage.error('设置失败')
  }
}

const deleteMirror = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除此镜像源吗？', '警告', {
      type: 'warning'
    })
    await settingsStore.deleteMirror(id)
    mirrors.value = settingsStore.mirrors
    ElMessage.success('已删除')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}
</script>

<style scoped>
.settings-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}
.settings-card, .mirrors-card {
  margin-bottom: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>