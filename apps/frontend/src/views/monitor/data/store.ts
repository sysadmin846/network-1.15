import { ref } from 'vue';

import type { MonitorTarget } from './targets';

// 共享的监控目标列表（响应式）- 初始为空，从数据库加载
export const sharedTargets = ref<MonitorTarget[]>([]);

// 标记是否已从数据库加载
export const isLoaded = ref(false);

// 添加目标
export function addTarget(target: MonitorTarget) {
  sharedTargets.value.push(target);
}

// 更新目标
export function updateTarget(key: string, data: Partial<MonitorTarget>) {
  const index = sharedTargets.value.findIndex(t => t.key === key);
  if (index > -1) {
    sharedTargets.value[index] = { ...sharedTargets.value[index], ...data } as MonitorTarget;
  }
}

// 删除目标
export function removeTarget(key: string) {
  const index = sharedTargets.value.findIndex(t => t.key === key);
  if (index > -1) {
    sharedTargets.value.splice(index, 1);
  }
}

// 获取目标
export function getTarget(key: string) {
  return sharedTargets.value.find(t => t.key === key);
}
