<template>
  <Page title="监控面板" description="实时监控网络状态">
    <template #extra>
      <div class="flex items-center gap-4">
        <!-- 统计信息 -->
        <div class="flex items-center gap-2 text-sm">
          <DesktopOutlined class="text-primary" />
          <span class="text-muted-foreground">总数:</span>
          <span class="font-semibold">{{ monitorTargets.length }}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <CheckCircleOutlined class="text-green-500" />
          <span class="text-muted-foreground">在线:</span>
          <span class="font-semibold text-green-500">{{ onlineCount }}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <CloseCircleOutlined class="text-red-500" />
          <span class="text-muted-foreground">离线:</span>
          <span class="font-semibold text-red-500">{{ offlineCount }}</span>
        </div>
        <div class="mx-2 h-4 w-px bg-border"></div>
        <!-- 搜索和按钮 -->
        <Input
          v-model:value="searchKeyword"
          placeholder="搜索名称/地址"
          style="width: 180px"
          allow-clear
          size="small"
        >
          <template #prefix><SearchOutlined /></template>
        </Input>
        <Button size="small" :loading="syncing" @click="handleSyncData">
          <template #icon><SyncOutlined /></template>
          同步
        </Button>
        <Button type="primary" size="small" @click="handleAddTarget">
          <template #icon><PlusOutlined /></template>
          添加
        </Button>
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <!-- 监控目标列表 - 每个目标一个卡片 -->
      <div v-for="target in filteredTargets" :key="target.key" class="bg-card rounded-lg p-4 shadow-sm">
        <!-- 顶部信息栏 -->
        <div class="mb-3 flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-6">
            <div class="flex items-center gap-2">
              <Badge :status="target.status === 'online' ? 'success' : 'error'" />
              <span class="font-semibold">{{ target.name }}</span>
            </div>
            <div class="text-sm text-muted-foreground">
              <span>地址: {{ target.address }}</span>
            </div>
            <div class="text-sm text-muted-foreground">
              <span>{{ target.protocol }}{{ target.port ? `:${target.port}` : '' }}</span>
            </div>
            <div v-if="target.remark" class="text-sm text-muted-foreground">
              <span>备注: {{ target.remark }}</span>
            </div>
            <div class="text-sm text-muted-foreground">
              <span>刷新: {{ target.refreshInterval }}秒</span>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="text-xs text-muted-foreground">当前RTT</div>
              <div :class="getRttClass(target.rtt, target.status)" class="text-lg font-semibold">
                {{ target.status === 'offline' ? '未响应' : `${target.rtt} ms` }}
              </div>
            </div>
            <Space>
              <Button size="small" type="link" @click="handleEditTarget(target)">编辑</Button>
              <Popconfirm title="确定删除该监控目标？" @confirm="handleDeleteTarget(target)">
                <Button danger size="small" type="link">删除</Button>
              </Popconfirm>
            </Space>
          </div>
        </div>
        <!-- RTT 图表 -->
        <div :ref="(el) => setChartRef(el, target.key)" class="h-[150px] w-full"></div>
      </div>

      <!-- 无数据提示 -->
      <div v-if="filteredTargets.length === 0" class="bg-card flex flex-col items-center justify-center rounded-lg py-12 shadow-sm">
        <Empty description="暂无监控目标" />
        <Button type="primary" class="mt-4" @click="handleAddTarget">
          <template #icon><PlusOutlined /></template>
          添加监控目标
        </Button>
      </div>
    </div>

    <!-- 添加/编辑监控目标弹窗 -->
    <Modal
      v-model:open="modalVisible"
      :title="isEdit ? '编辑监控目标' : '添加监控目标'"
      @ok="handleSubmit"
    >
      <Form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        :label-col="{ span: 5 }"
        :wrapper-col="{ span: 18 }"
      >
        <FormItem label="名称" name="name">
          <Input v-model:value="formData.name" placeholder="请输入名称" />
        </FormItem>
        <FormItem label="地址" name="address">
          <Input v-model:value="formData.address" placeholder="请输入IP地址或域名" />
        </FormItem>
        <FormItem label="协议" name="protocol">
          <div class="flex gap-2">
            <Select v-model:value="formData.protocol" placeholder="请选择协议" style="width: 120px">
              <SelectOption value="ICMP">ICMP</SelectOption>
              <SelectOption value="TCP">TCP</SelectOption>
              <SelectOption value="UDP">UDP</SelectOption>
              <SelectOption value="HTTP">HTTP</SelectOption>
              <SelectOption value="HTTPS">HTTPS</SelectOption>
            </Select>
            <InputNumber
              v-model:value="formData.port"
              placeholder="端口"
              :min="1"
              :max="65535"
              style="width: 100px"
            />
          </div>
        </FormItem>
        <FormItem label="备注" name="remark">
          <Textarea v-model:value="formData.remark" placeholder="请输入备注" :rows="3" />
        </FormItem>
        <FormItem label="刷新间隔" name="refreshInterval">
          <Select v-model:value="formData.refreshInterval" placeholder="请选择刷新间隔" style="width: 200px">
            <SelectOption :value="1">1秒</SelectOption>
            <SelectOption :value="2">2秒</SelectOption>
            <SelectOption :value="5">5秒</SelectOption>
            <SelectOption :value="10">10秒</SelectOption>
          </Select>
        </FormItem>
        <FormItem label="最大延迟" name="maxRtt">
          <InputNumber v-model:value="formData.maxRtt" :min="10" :max="10000" style="width: 200px" addon-after="ms" />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>

<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';

import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { usePreferences } from '@vben/preferences';

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DesktopOutlined,
  PlusOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue';
import {
  Badge,
  Button,
  Empty,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  SelectOption,
  Space,
  Textarea,
} from 'ant-design-vue';
import * as echarts from 'echarts';

import type { MonitorTarget } from '../data/targets';
import { sharedTargets, isLoaded } from '../data/store';
import { deleteTarget, fetchMonitorLogs, initDatabase, loadTargetsToStore, saveMonitorLog, saveTarget } from '../data/api';

const { isDark } = usePreferences();

// 监控目标数据（使用共享数据）
const monitorTargets = sharedTargets;

// 搜索关键词
const searchKeyword = ref('');

// 同步状态
const syncing = ref(false);

// 统计数据
const onlineCount = computed(() => monitorTargets.value.filter((t) => t.status === 'online').length);
const offlineCount = computed(() => monitorTargets.value.filter((t) => t.status === 'offline').length);

// 过滤后的目标列表
const filteredTargets = computed(() => {
  if (!searchKeyword.value) return monitorTargets.value;
  const keyword = searchKeyword.value.toLowerCase();
  return monitorTargets.value.filter(
    (t) => t.name.toLowerCase().includes(keyword) || t.address.toLowerCase().includes(keyword),
  );
});

// 图表实例映射
const chartInstances = new Map<string, echarts.ECharts>();
const chartRefs = new Map<string, HTMLDivElement>();

const setChartRef = (el: any, key: string) => {
  if (el) {
    chartRefs.set(key, el as HTMLDivElement);
  } else {
    // 元素被移除时清理引用
    chartRefs.delete(key);
  }
};

// 弹窗相关
const modalVisible = ref(false);
const isEdit = ref(false);
const formRef = ref<FormInstance>();

const formData = reactive({
  key: '',
  name: '',
  address: '',
  protocol: '',
  port: null as number | null,
  remark: '',
  refreshInterval: 2,
  maxRtt: 100,
});

const formRules = {
  name: [{ required: true, message: '请输入名称' }],
  address: [{ required: true, message: '请输入地址' }],
  protocol: [{ required: true, message: '请选择协议' }],
};

const resetForm = () => {
  formData.key = '';
  formData.name = '';
  formData.address = '';
  formData.protocol = '';
  formData.port = null;
  formData.remark = '';
  formData.refreshInterval = 2;
  formData.maxRtt = 100;
};

const handleAddTarget = () => {
  isEdit.value = false;
  resetForm();
  modalVisible.value = true;
};

const handleEditTarget = (record: MonitorTarget) => {
  isEdit.value = true;
  Object.assign(formData, {
    key: record.key,
    name: record.name,
    address: record.address,
    protocol: record.protocol,
    port: record.port,
    remark: record.remark,
    refreshInterval: record.refreshInterval,
    maxRtt: record.maxRtt || 100,
  });
  modalVisible.value = true;
};

const handleDeleteTarget = async (record: MonitorTarget) => {
  try {
    // 从数据库删除
    await deleteTarget(record.key);
    
    const chart = chartInstances.get(record.key);
    if (chart) {
      chart.dispose();
      chartInstances.delete(record.key);
    }
    chartRefs.delete(record.key);
    stopTimer(record.key);
    monitorTargets.value = monitorTargets.value.filter((item) => item.key !== record.key);
    message.success('删除成功');
  } catch (error: any) {
    message.error(error.message || '删除失败');
  }
};

const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
    if (isEdit.value) {
      const index = monitorTargets.value.findIndex((item) => item.key === formData.key);
      if (index > -1) {
        const existingTarget = monitorTargets.value[index];
        if (!existingTarget) return;
        
        // 保存到数据库
        await saveTarget({
          key: existingTarget.key,
          name: formData.name,
          address: formData.address,
          protocol: formData.protocol,
          port: formData.port,
          remark: formData.remark,
          refreshInterval: formData.refreshInterval,
          maxRtt: formData.maxRtt,
        });
        
        monitorTargets.value[index] = {
          key: existingTarget.key,
          name: formData.name,
          address: formData.address,
          protocol: formData.protocol,
          port: formData.port,
          status: existingTarget.status,
          rtt: existingTarget.rtt,
          remark: formData.remark,
          refreshInterval: formData.refreshInterval,
          maxRtt: formData.maxRtt,
          rttHistory: existingTarget.rttHistory,
          timeLabels: existingTarget.timeLabels,
        };
        // 重新启动定时器以应用新的刷新间隔
        const target = monitorTargets.value[index];
        if (target) {
          // 重新初始化图表以应用新的Y轴最大值
          initChartForTarget(target.key);
          startTimer(target);
        }
      }
      message.success('编辑成功');
    } else {
      const newKey = Date.now().toString();
      
      // 保存到数据库
      await saveTarget({
        key: newKey,
        name: formData.name,
        address: formData.address,
        protocol: formData.protocol,
        port: formData.port,
        remark: formData.remark,
        refreshInterval: formData.refreshInterval,
        maxRtt: formData.maxRtt,
      });
      
      const newTarget: MonitorTarget = {
        key: newKey,
        name: formData.name,
        address: formData.address,
        protocol: formData.protocol,
        port: formData.port,
        status: 'online',
        rtt: 0,
        remark: formData.remark,
        refreshInterval: formData.refreshInterval,
        maxRtt: formData.maxRtt,
        rttHistory: [],
        timeLabels: [],
      };
      monitorTargets.value.push(newTarget);
      message.success('添加成功');
      modalVisible.value = false;
      
      // 等待DOM更新后初始化图表（使用重试机制确保DOM已渲染）
      const initNewChart = async (retries = 5) => {
        await nextTick();
        const target = monitorTargets.value.find(t => t.key === newKey);
        if (!target) return;
        
        const el = chartRefs.get(newKey);
        if (!el && retries > 0) {
          // DOM还没准备好，等待后重试
          setTimeout(() => initNewChart(retries - 1), 100);
          return;
        }
        
        if (el) {
          initChartForTarget(newKey);
          // 立即执行第一次ping
          await updateSingleTarget(target);
          // 启动定时器
          startTimer(target);
        }
      };
      
      initNewChart();
      return;
    }
    modalVisible.value = false;
  } catch (error: any) {
    message.error(error.message || '操作失败');
  }
};

// 主题相关颜色
const chartColors = computed(() => ({
  axisLine: isDark.value ? '#4a4a4a' : '#e0e0e0',
  axisLabel: isDark.value ? '#a0a0a0' : '#666',
  splitLine: isDark.value ? '#333' : '#f0f0f0',
  tooltipBg: isDark.value ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
  tooltipBorder: isDark.value ? '#4a4a4a' : '#e0e0e0',
  tooltipText: isDark.value ? '#e0e0e0' : '#333',
}));

const getRttClass = (rtt: number, status?: string): string => {
  // 离线或超时显示红色
  if (status === 'offline' || rtt === 0) return 'text-red-500';
  if (rtt < 50) return 'text-green-500';
  if (rtt < 100) return 'text-yellow-500';
  return 'text-red-500';
};

// 生成时间字符串
const generateTimeStr = (timestamp: number): string => {
  const now = new Date(timestamp);
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
};

// 生成RTT数据（仅用于初始化历史数据）
const generateRtt = (status: string): number => {
  return status === 'offline' ? 0 : Math.floor(Math.random() * 40) + 30;
};

// 真实ping探测
const pingTarget = async (target: MonitorTarget): Promise<{ status: string; rtt: number }> => {
  try {
    const res = await fetch('/api/monitor/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: target.address,
        protocol: target.protocol,
        port: target.port,
      }),
    });
    const result = await res.json();
    return {
      status: result.status || 'offline',
      rtt: result.rtt || 0,
    };
  } catch {
    return { status: 'offline', rtt: 0 };
  }
};

// 追加数据点到目标（统一的数据处理逻辑，确保时间连续）
const appendPoint = (target: MonitorTarget, rtt?: number, timestamp?: number) => {
  const time = timestamp || Date.now();
  const refreshInterval = target.refreshInterval;
  
  // 对齐到刷新间隔的整数秒
  const alignedTime = Math.floor(time / 1000 / refreshInterval) * refreshInterval * 1000;
  const timeStr = generateTimeStr(alignedTime);
  const actualRtt = rtt !== undefined ? rtt : 0;

  // 检查是否与最后一个时间点相同，避免重复
  if (target.timeLabels.length > 0 && target.timeLabels[target.timeLabels.length - 1] === timeStr) {
    // 更新最后一个数据点而不是添加新的
    target.rtt = actualRtt;
    target.rttHistory[target.rttHistory.length - 1] = actualRtt;
    return;
  }

  // 检查是否有跳过的时间点，如果有则补充
  if (target.timeLabels.length > 0) {
    const lastTimeStr = target.timeLabels[target.timeLabels.length - 1];
    const lastTimeParts = lastTimeStr.split(':').map(Number);
    const lastSeconds = lastTimeParts[0] * 3600 + lastTimeParts[1] * 60 + lastTimeParts[2];
    
    const currentTimeParts = timeStr.split(':').map(Number);
    const currentSeconds = currentTimeParts[0] * 3600 + currentTimeParts[1] * 60 + currentTimeParts[2];
    
    // 计算应该有多少个时间点
    let diff = currentSeconds - lastSeconds;
    if (diff < 0) diff += 24 * 3600; // 跨天处理
    
    const expectedPoints = Math.floor(diff / refreshInterval);
    
    // 如果跳过了时间点，补充中间的数据（使用上一个值）
    if (expectedPoints > 1) {
      const lastRtt = target.rttHistory[target.rttHistory.length - 1] || 0;
      for (let i = 1; i < expectedPoints; i++) {
        const missedSeconds = lastSeconds + i * refreshInterval;
        const h = Math.floor((missedSeconds % (24 * 3600)) / 3600);
        const m = Math.floor((missedSeconds % 3600) / 60);
        const s = missedSeconds % 60;
        const missedTimeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        
        target.rttHistory.push(lastRtt);
        target.timeLabels.push(missedTimeStr);
        
        // 保持固定长度
        if (target.rttHistory.length > DATA_POINTS) {
          target.rttHistory.shift();
          target.timeLabels.shift();
        }
      }
    }
  }

  target.rtt = actualRtt;
  target.rttHistory.push(actualRtt);
  target.timeLabels.push(timeStr);

  // 保持固定长度
  if (target.rttHistory.length > DATA_POINTS) {
    target.rttHistory.shift();
    target.timeLabels.shift();
  }
};

// 固定数据点数量
const DATA_POINTS = 30;

// 初始化单个目标的图表
const initChartForTarget = (key: string) => {
  const el = chartRefs.get(key);
  if (!el) return;
  
  const target = monitorTargets.value.find((t) => t.key === key);
  if (!target) return;

  let chart = chartInstances.get(key);
  if (!chart) {
    chart = echarts.init(el, undefined, { renderer: 'canvas' });
    chartInstances.set(key, chart);
  }

  // 确定线条颜色
  const isOffline = target.status === 'offline';
  const lineColor = isOffline ? '#ff4d4f' : '#1890ff';
  const areaGradient = isOffline 
    ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(255, 77, 79, 0.3)' },
        { offset: 1, color: 'rgba(255, 77, 79, 0.05)' },
      ])
    : new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
        { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
      ]);

  const colors = chartColors.value;
  const option: echarts.EChartsOption = {
    // 减少动画时间，提升性能
    animation: true,
    animationDuration: 200,
    animationDurationUpdate: 200,
    animationEasing: 'linear',
    animationEasingUpdate: 'linear',
    grid: { left: 50, right: 20, bottom: 30, top: 10 },
    xAxis: {
      type: 'category',
      data: target.timeLabels.length > 0 ? target.timeLabels : [],
      boundaryGap: false,
      axisLine: { lineStyle: { color: colors.axisLine } },
      axisLabel: { 
        color: colors.axisLabel, 
        fontSize: 10,
      },
      // X轴动画配置
      animation: true,
    },
    yAxis: {
      type: 'value',
      name: 'ms',
      nameTextStyle: { color: colors.axisLabel, fontSize: 10 },
      axisLine: { lineStyle: { color: colors.axisLine } },
      axisLabel: { color: colors.axisLabel, fontSize: 10 },
      splitLine: { lineStyle: { color: colors.splitLine } },
      min: 0,
      max: target.maxRtt || 100,
    },
    series: [{
      type: 'line',
      smooth: 0.3,
      data: target.rttHistory.length > 0 ? target.rttHistory : [],
      lineStyle: { color: lineColor, width: 2 },
      areaStyle: { color: areaGradient },
      itemStyle: { color: lineColor },
      symbol: 'none',
    }],
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.tooltipBg,
      borderColor: colors.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: colors.tooltipText, fontSize: 12 },
      formatter: (params: any) => {
        if (!params || !params[0]) return '';
        return `${params[0].axisValue}<br/>RTT: ${params[0].value} ms`;
      },
    },
  };
  chart.setOption(option, true);
};

// 初始化历史数据（从数据库加载，并对齐到刷新间隔）
const initHistoryData = async (key: string) => {
  const target = monitorTargets.value.find((t) => t.key === key);
  if (!target) return;
  
  // 清空现有数据
  target.rttHistory = [];
  target.timeLabels = [];
  
  try {
    // 从数据库获取最近的历史数据
    const logs = await fetchMonitorLogs({
      targetKey: key,
      limit: DATA_POINTS,
    });
    
    console.log(`[${target.name}] 从数据库获取了 ${logs?.length || 0} 条原始数据`);
    
    if (logs && logs.length > 0) {
      const refreshInterval = target.refreshInterval;
      
      // 按时间间隔分组数据，确保每个时间点只有一条数据
      const groupedData = new Map<string, { rtt: number; status: string }>();
      
      logs.forEach((log: any) => {
        // 直接解析时间字符串，避免时区转换问题
        // 数据库返回的格式: "2026-01-17T00:42:28.000Z"
        // 但实际保存的是本地时间，所以需要去掉Z后缀
        const timeStr = log.createdAt.replace('Z', '').replace('T', ' ');
        const createdAt = new Date(timeStr);
        
        // 生成时间键（HH:MM:SS格式）
        const timeKey = `${createdAt.getHours().toString().padStart(2, '0')}:${createdAt.getMinutes().toString().padStart(2, '0')}:${createdAt.getSeconds().toString().padStart(2, '0')}`;
        
        // 只保留每个时间点的最新数据（防止重复）
        groupedData.set(timeKey, { rtt: log.rtt, status: log.status });
      });
      
      // 转换为数组并排序
      const sortedData = Array.from(groupedData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      
      // 取最后 DATA_POINTS 个数据点
      const recentData = sortedData.slice(-DATA_POINTS);
      
      console.log(`[${target.name}] 处理后得到 ${recentData.length} 条数据，时间范围: ${recentData[0]?.[0]} ~ ${recentData[recentData.length - 1]?.[0]}`);
      
      recentData.forEach(([timeStr, data]) => {
        target.rttHistory.push(data.rtt);
        target.timeLabels.push(timeStr);
      });
      
      // 用最后一条历史数据更新当前显示状态
      if (recentData.length > 0) {
        const lastData = recentData[recentData.length - 1][1];
        target.status = lastData.status;
        target.rtt = lastData.rtt;
      }
      
      console.log(`[${target.name}] 历史数据加载完成`);
    } else {
      console.log(`[${target.name}] 无历史数据，等待实时数据`);
    }
  } catch (error) {
    console.error(`加载 ${target.name} 历史数据失败:`, error);
  }
};

// 同步数据（重新加载历史数据并重启定时器）
const handleSyncData = async () => {
  syncing.value = true;
  
  try {
    // 停止所有定时器
    targetTimers.forEach((timer) => clearTimeout(timer));
    targetTimers.clear();
    nextExecutionTime.clear();
    
    // 重新加载监控目标
    await loadTargetsFromDB();
    
    // 重新加载所有目标的历史数据
    await Promise.all(monitorTargets.value.map((target) => initHistoryData(target.key)));
    
    // 等待 DOM 更新
    await nextTick();
    
    // 重新初始化所有图表
    monitorTargets.value.forEach((target) => {
      initChartForTarget(target.key);
    });
    
    // 重新启动所有定时器
    startAllTimers();
    
    message.success('数据同步成功');
  } catch (error: any) {
    message.error(error.message || '同步失败');
  } finally {
    syncing.value = false;
  }
};

// 更新单个目标的图表（滑动效果）- 使用真实ping
const updateSingleTarget = async (target: MonitorTarget) => {
  // 调用真实ping API
  const { status, rtt } = await pingTarget(target);
  
  // 更新状态
  target.status = status;
  
  // 生成当前时间字符串（用于防重复）
  const now = Date.now();
  const timeStr = generateTimeStr(now);
  
  // 检查是否已经保存过这个时间点的数据
  const lastTime = lastSavedTime.get(target.key);
  const shouldSave = lastTime !== timeStr;
  
  // 追加新数据点
  appendPoint(target, rtt, now);
  
  // 保存到数据库（防止重复保存同一秒的数据）
  if (shouldSave) {
    lastSavedTime.set(target.key, timeStr);
    try {
      await saveMonitorLog({
        targetKey: target.key,
        targetName: target.name,
        rtt,
        status,
        refreshInterval: target.refreshInterval,
      });
    } catch (error) {
      console.error('保存监控日志失败:', error);
    }
  }

  const chart = chartInstances.get(target.key);
  if (chart) {
    // 根据状态设置颜色
    const isOffline = status === 'offline';
    const lineColor = isOffline ? '#ff4d4f' : '#1890ff';
    const areaColor = isOffline 
      ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(255, 77, 79, 0.3)' },
          { offset: 1, color: 'rgba(255, 77, 79, 0.05)' },
        ])
      : new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
          { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
        ]);
    
    // 使用 requestAnimationFrame 优化渲染性能
    requestAnimationFrame(() => {
      chart.setOption({
        xAxis: { data: target.timeLabels },
        series: [{ 
          data: target.rttHistory,
          lineStyle: { color: lineColor, width: 2 },
          areaStyle: { color: areaColor },
          itemStyle: { color: lineColor },
        }],
      }, {
        notMerge: false,
        lazyUpdate: true,  // 启用延迟更新，减少重绘
      });
    });
  }
};

// 为每个目标维护独立的定时器
const targetTimers = new Map<string, ReturnType<typeof setTimeout>>();
// 记录每个目标的下次执行时间
const nextExecutionTime = new Map<string, number>();
// 记录每个目标最后保存到数据库的时间（秒级）
const lastSavedTime = new Map<string, string>();

// 启动所有目标的定时器（并行执行，互不阻塞）
const startAllTimers = () => {
  monitorTargets.value.forEach((target) => {
    startTimer(target);
  });
};

// 启动单个目标的定时器（严格按照刷新间隔执行）
const startTimer = (target: MonitorTarget) => {
  // 清除现有定时器
  stopTimer(target.key);
  
  const intervalMs = target.refreshInterval * 1000;
  
  // 计算下一个对齐的时间点
  const now = Date.now();
  const currentSecond = Math.floor(now / 1000);
  const alignedSecond = Math.ceil(currentSecond / target.refreshInterval) * target.refreshInterval;
  let nextTime = alignedSecond * 1000;
  
  // 如果计算出的时间已经过去或太近，跳到下一个周期
  if (nextTime <= now + 100) {
    nextTime += intervalMs;
  }
  
  nextExecutionTime.set(target.key, nextTime);
  
  // 执行一次更新的函数
  const executeUpdate = async () => {
    // 记录开始时间
    const startTime = Date.now();
    const expectedTime = nextExecutionTime.get(target.key) || startTime;
    
    // 执行更新
    await updateSingleTarget(target);
    
    // 计算下一次执行时间（严格基于间隔，不受执行时间影响）
    let nextExpectedTime = expectedTime + intervalMs;
    
    // 如果下一次时间已经过去（执行太慢），跳到最近的未来时间点
    const currentTime = Date.now();
    while (nextExpectedTime <= currentTime + 100) {
      nextExpectedTime += intervalMs;
    }
    
    nextExecutionTime.set(target.key, nextExpectedTime);
    
    // 计算到下一次执行的延迟
    const delay = nextExpectedTime - currentTime;
    
    // 设置下一次执行
    const timer = setTimeout(executeUpdate, delay);
    targetTimers.set(target.key, timer);
  };
  
  // 计算首次执行的延迟
  const initialDelay = nextTime - now;
  
  // 设置首次执行
  const timer = setTimeout(executeUpdate, initialDelay);
  targetTimers.set(target.key, timer);
};

// 停止单个目标的定时器
const stopTimer = (key: string) => {
  const timer = targetTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    targetTimers.delete(key);
  }
  nextExecutionTime.delete(key);
};

// 更新所有图表主题
const updateAllChartsTheme = () => {
  monitorTargets.value.forEach((target) => {
    initChartForTarget(target.key);
  });
};

watch(isDark, () => updateAllChartsTheme());

// 监听过滤结果变化，重新初始化图表
watch(filteredTargets, async (newTargets, oldTargets) => {
  // 清理不再显示的图表实例
  if (oldTargets) {
    const newKeys = new Set(newTargets.map(t => t.key));
    oldTargets.forEach((target) => {
      if (!newKeys.has(target.key)) {
        const chart = chartInstances.get(target.key);
        if (chart) {
          chart.dispose();
          chartInstances.delete(target.key);
        }
        chartRefs.delete(target.key);
        stopTimer(target.key);
      }
    });
  }
  
  // 等待 DOM 更新完成
  await nextTick();
  
  // 只重新初始化已有图表实例的目标（搜索过滤场景）
  // 新添加的目标由 handleSubmit 中的 initNewChart 处理
  const existingTargets = newTargets.filter(t => chartInstances.has(t.key) || chartRefs.has(t.key));
  if (existingTargets.length > 0) {
    batchInitCharts(existingTargets);
  }
});

// 分批初始化图表，避免一次性渲染过多导致卡顿
const batchInitCharts = (targets: MonitorTarget[], batchSize = 5) => {
  if (targets.length === 0) return;
  
  let index = 0;
  console.log(`开始批量初始化 ${targets.length} 个图表，每批 ${batchSize} 个`);
  
  const initBatch = () => {
    const batch = targets.slice(index, index + batchSize);
    console.log(`初始化第 ${Math.floor(index / batchSize) + 1} 批图表，共 ${batch.length} 个`);
    
    batch.forEach((target) => {
      initChartForTarget(target.key);
    });
    index += batchSize;
    
    if (index < targets.length) {
      requestAnimationFrame(initBatch);
    } else {
      console.log('所有图表初始化完成');
    }
  };
  
  requestAnimationFrame(initBatch);
};

// 从数据库加载监控目标（使用统一的加载函数）
const loadTargetsFromDB = async () => {
  await loadTargetsToStore();
  console.log('从数据库加载了', monitorTargets.value.length, '个监控目标');
};

onMounted(async () => {
  // 从数据库加载监控目标
  await loadTargetsFromDB();
  
  // 先初始化所有目标的历史数据（从数据库加载）
  await Promise.all(monitorTargets.value.map((target) => initHistoryData(target.key)));

  // 等待 DOM 完全渲染后再初始化图表
  nextTick(() => {
    // 额外延迟确保 v-for 渲染的 ref 已设置
    setTimeout(() => {
      batchInitCharts(monitorTargets.value);
      // 启动所有目标的定时器
      startAllTimers();
    }, 50);
  });

  // 使用防抖处理 resize
  let resizeTimer: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      chartInstances.forEach((chart) => chart.resize());
    }, 100);
  });
});

onUnmounted(() => {
  targetTimers.forEach((timer) => clearTimeout(timer));
  targetTimers.clear();
  nextExecutionTime.clear();
  lastSavedTime.clear();
  chartInstances.forEach((chart) => chart.dispose());
  chartInstances.clear();
});
</script>
