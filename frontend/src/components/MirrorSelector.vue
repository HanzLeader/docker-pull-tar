<template>
  <el-select
    v-model="selectedMirror"
    placeholder="选择镜像源"
    @change="handleChange"
    class="mirror-selector"
  >
    <el-option
      v-for="mirror in mirrors"
      :key="mirror.id"
      :label="mirror.name"
      :value="mirror.registry"
    >
      <div class="mirror-option">
        <span>{{ mirror.name }}</span>
        <span v-if="mirror.isDefault" class="default-badge">默认</span>
      </div>
    </el-option>
  </el-select>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])

const settingsStore = useSettingsStore()
const mirrors = computed(() => settingsStore.mirrors)

const selectedMirror = ref(props.modelValue || settingsStore.getDefaultMirrorRegistry())

watch(() => props.modelValue, (val) => {
  if (val) {
    selectedMirror.value = val
  }
})

const handleChange = (value) => {
  emit('update:modelValue', value)
}
</script>

<style scoped>
.mirror-selector {
  width: 100%;
}
.mirror-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.default-badge {
  background: #409eff;
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}
</style>