<template>
  <Page title="数据查询" description="查询监控对象的历史数据">
    <template #extra>
      <div class="flex items-center gap-4">
        <Button size="small" :loading="syncing" @click="handleSyncData">
          <template #icon><SyncOutlined /></template>
          同步
        </Button>
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <InfoCircleOutlined />
          <span>数据来源: 数据库实时查询</span>
        </div>
      </div>
    </template>
    <div class="bg-card rounded-lg p-4">
      <!-- 查询表单 -->
      <div class="mb-4 flex flex-wrap items-end gap-4 border-b border-border pb-4">
        <div class="flex flex-col gap-1">
          <span class="text-sm text-muted-foreground">监控对象</span>
          <Select
            v-model:value="queryForm.targetKey"
            placeholder="请选择监控对象"
            style="width: 280px"
            allow-clear
          >
            <SelectOption
              v-for="target in monitorTargets"
              :key="target.key"
              :value="target.key"
            >
              {{ target.name }} ({{ target.address }}{{ target.port ? `:${target.port}` : '' }})
            </SelectOption>
          </Select>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-sm text-muted-foreground">时间范围</span>
          <RangePicker
            v-model:value="queryForm.timeRange"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            :popup-class-name="'time-picker-centered'"
            @open-change="onPickerOpenChange"
          />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-sm text-muted-foreground">显示窗口</span>
          <Select v-model:value="displayWindow" style="width: 120px">
            <SelectOption :value="1">1分钟</SelectOption>
            <SelectOption :value="2">2分钟</SelectOption>
            <SelectOption :value="3">3分钟</SelectOption>
            <SelectOption :value="5">5分钟</SelectOption>
            <SelectOption :value="10">10分钟</SelectOption>
          </Select>
        </div>
        <div class="flex gap-2">
          <Button type="primary" @click="handleQuery">
            <template #icon><SearchOutlined /></template>
            查询
          </Button>
          <Button @click="handleReset">
            <template #icon><ReloadOutlined /></template>
            重置
          </Button>
        </div>
      </div>

      <!-- 查询结果图表 -->
      <div v-if="queryResults.length > 0" class="mb-4">
        <div class="mb-2 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            数据间隔: {{ dataIntervalText }}
            <span class="ml-2 text-blue-500">({{ dataSourceText }})</span>
            <span v-if="isSampled" class="ml-2 text-yellow-500">
              原始间隔: {{ originalIntervalText }}
            </span>
          </span>
          <span>共 {{ fullChartData.length }} 个数据点</span>
        </div>
        <div ref="queryChartRef" class="h-[300px] w-full"></div>
      </div>

      <!-- 查询结果表格 -->
      <Table
        :columns="queryResultColumns"
        :data-source="queryResults"
        :loading="queryLoading"
        :pagination="queryPagination"
        size="small"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <Badge
              :status="record.status === 'online' ? 'success' : 'error'"
              :text="record.status === 'online' ? '在线' : '离线'"
            />
          </template>
          <template v-if="column.key === 'rtt'">
            <span :class="getRttClass(record.rtt, record.status)">
              {{ record.status === 'offline' ? '未响应' : `${record.rtt} ms` }}
            </span>
          </template>
        </template>
      </Table>
    </div>
  </Page>
</template>

<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { usePreferences } from '@vben/preferences';

import { InfoCircleOutlined, ReloadOutlined, SearchOutlined, SyncOutlined } from '@ant-design/icons-vue';
import { Badge, Button, DatePicker, Select, SelectOption, Table } from 'ant-design-vue';

const { RangePicker } = DatePicker;
import * as echarts from 'echarts';

import { sharedTargets, isLoaded } from '../data/store';
import { fetchMonitorLogs, loadTargetsToStore } from '../data/api';

const { isDark } = usePreferences();

// 使用共享的监控对象列表
const monitorTargets = sharedTargets;

// 同步状态
const syncing = ref(false);

// 同步数据
const handleSyncData = async () => {
  syncing.value = true;
  try {
    // 强制重新加载
    isLoaded.value = false;
    await loadTargetsToStore();
    // 如果已有查询结果，重新查询
    if (queryForm.targetKey) {
      await handleQuery();
    }
  } finally {
    syncing.value = false;
  }
};

// 页面加载时从数据库加载监控目标
onMounted(async () => {
  await loadTargetsToStore();
});

// 显示窗口（分钟）
const displayWindow = ref(5);

// 查询表单
const queryForm = reactive<{
  targetKey: string | undefined;
  timeRange: [Dayjs, Dayjs] | null;
}>({
  targetKey: undefined,
  timeRange: null,
});

// 查询结果
const queryLoading = ref(false);
const queryResults = ref<
  {
    key: string;
    name: string;
    address: string;
    status: string;
    rtt: number;
    time: string;
    shortTime: string;
  }[]
>([]);
const queryPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

// 存储完整的图表数据用于缩放
const fullChartData = ref<{ time: string; rtt: number; status: string; fullTime: string }[]>([]);

// 离线点索引列表
const offlinePoints = ref<number[]>([]);
// 当前离线点索引
const currentOfflineIndex = ref(0);

// 当前数据间隔（秒）
const currentDataInterval = ref(2);

// 原始刷新间隔（秒）
const originalRefreshInterval = ref(2);

// 是否进行了采样
const isSampled = computed(() => currentDataInterval.value !== originalRefreshInterval.value);

// 数据间隔显示文本
const dataIntervalText = computed(() => {
  const interval = currentDataInterval.value;
  if (interval < 60) {
    return `${interval}秒`;
  } else if (interval < 3600) {
    return `${Math.round(interval / 60)}分钟`;
  } else {
    return `${Math.round(interval / 3600)}小时`;
  }
});

// 原始间隔显示文本
const originalIntervalText = computed(() => {
  return `${originalRefreshInterval.value}秒`;
});

// 数据来源说明
const dataSourceText = computed(() => {
  const interval = currentDataInterval.value;
  if (interval === originalRefreshInterval.value) {
    return '原始数据';
  } else if (interval <= 10) {
    return '10秒聚合';
  } else if (interval <= 60) {
    return '1分钟聚合';
  } else if (interval <= 300) {
    return '5分钟聚合';
  } else {
    return '15分钟聚合';
  }
});

// 图表
const queryChartRef = ref<HTMLDivElement>();
let chartInstance: echarts.ECharts | null = null;

// 查询结果表格列
const queryResultColumns = [
  { title: '监控对象', dataIndex: 'name', key: 'name' },
  { title: '地址', dataIndex: 'address', key: 'address' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: 'RTT (ms)', dataIndex: 'rtt', key: 'rtt' },
  { title: '检测时间', dataIndex: 'time', key: 'time' },
];

// 主题颜色
const chartColors = computed(() => ({
  axisLine: isDark.value ? '#4a4a4a' : '#e0e0e0',
  axisLabel: isDark.value ? '#a0a0a0' : '#666',
  splitLine: isDark.value ? '#333' : '#f0f0f0',
  tooltipBg: isDark.value ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
  tooltipBorder: isDark.value ? '#4a4a4a' : '#e0e0e0',
  tooltipText: isDark.value ? '#e0e0e0' : '#333',
  dataZoomBg: isDark.value ? '#333' : '#e8e8e8',
  dataZoomFill: isDark.value ? '#555' : '#d3d3d3',
}));

// 获取 RTT 样式类
const getRttClass = (rtt: number, status?: string): string => {
  if (status === 'offline') return 'text-red-500 font-medium';
  if (rtt >= 100) return 'text-red-500 font-medium';
  if (rtt >= 50) return 'text-yellow-500 font-medium';
  return 'text-green-500 font-medium';
};

// 根据状态和RTT值设置颜色
const getPointColor = (status: string, rtt: number) => {
  if (status === 'offline') return '#ef4444';
  if (rtt >= 100) return '#ef4444';
  if (rtt >= 50) return '#eab308';
  return '#22c55e';
};

// 初始化图表
const initChart = (data: { time: string; rtt: number; status: string; fullTime: string }[], scrollToStart = false) => {
  if (!queryChartRef.value) return;
  if (chartInstance) chartInstance.dispose();
  chartInstance = echarts.init(queryChartRef.value);
  const colors = chartColors.value;

  const seriesData = data.map((d) => ({
    value: d.status === 'offline' ? 0 : d.rtt,
    itemStyle: { color: getPointColor(d.status, d.rtt) },
  }));

  const pieces = data.map((d, index) => ({
    gt: index - 1,
    lte: index,
    color: getPointColor(d.status, d.rtt),
  }));

  // 计算初始显示范围（基于显示窗口）
  const windowMs = displayWindow.value * 60 * 1000;
  const totalMs = data.length > 1 ? 
    (new Date(data[data.length - 1].fullTime).getTime() - new Date(data[0].fullTime).getTime()) : 0;
  
  // 根据 scrollToStart 决定初始位置
  let startPercent: number;
  let endPercent: number;
  
  if (scrollToStart || totalMs <= windowMs) {
    // 定位到开始时间
    startPercent = 0;
    endPercent = totalMs > windowMs ? (windowMs / totalMs) * 100 : 100;
  } else {
    // 定位到结束时间
    endPercent = 100;
    startPercent = Math.max(0, 100 - (windowMs / totalMs) * 100);
  }

  const option: echarts.EChartsOption = {
    title: { text: 'RTT 趋势图（拖拽图表可左右滑动）', left: 'center', textStyle: { color: colors.tooltipText, fontSize: 14 } },
    grid: { left: '3%', right: '4%', bottom: '18%', top: '15%', containLabel: true },
    visualMap: {
      show: false,
      dimension: 0,
      pieces: pieces,
    },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.time),
      boundaryGap: false,
      axisLine: { lineStyle: { color: colors.axisLine } },
      axisLabel: { color: colors.axisLabel, rotate: 45 },
    },
    yAxis: {
      type: 'value',
      name: 'RTT (ms)',
      min: 0,
      axisLine: { lineStyle: { color: colors.axisLine } },
      axisLabel: { color: colors.axisLabel },
      splitLine: { lineStyle: { color: colors.splitLine } },
    },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: [0],
        start: startPercent,
        end: endPercent,
        zoomLock: true,
        // 禁用滚轮缩放，启用拖拽平移
        zoomOnMouseWheel: false,
        moveOnMouseWheel: false,
        moveOnMouseMove: true,
      },
      {
        type: 'slider',
        xAxisIndex: [0],
        start: startPercent,
        end: endPercent,
        height: 20,
        bottom: 5,
        zoomLock: true,
        brushSelect: false,
        backgroundColor: colors.dataZoomBg,
        fillerColor: colors.dataZoomFill,
        borderColor: colors.axisLine,
        handleStyle: { color: '#1890ff' },
        textStyle: { color: colors.axisLabel },
      },
    ],
    series: [{
      name: 'RTT',
      type: 'line',
      smooth: true,
      data: seriesData,
      lineStyle: { width: 2 },
      symbol: 'circle',
      symbolSize: 4,
    }],
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.tooltipBg,
      borderColor: colors.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: colors.tooltipText },
      formatter: (params: any) => {
        const dataIndex = params[0].dataIndex;
        const item = data[dataIndex];
        const statusText = item.status === 'offline' ? '离线' : '在线';
        const statusColor = item.status === 'offline' ? '#ef4444' : '#22c55e';
        return `${item.fullTime}<br/>
          状态: <span style="color:${statusColor}">${statusText}</span><br/>
          RTT: <span style="color:${getPointColor(item.status, item.rtt)}">${item.status === 'offline' ? '未响应' : item.rtt + ' ms'}</span>`;
      },
    },
  };
  chartInstance.setOption(option);
};

// 查询处理
const handleQuery = async () => {
  if (!queryForm.targetKey) return;
  queryLoading.value = true;
  const target = monitorTargets.value.find((t) => t.key === queryForm.targetKey);
  if (!target) {
    queryLoading.value = false;
    return;
  }
  
  try {
    // 使用监控对象的刷新间隔
    originalRefreshInterval.value = target.refreshInterval || 2;
    currentDataInterval.value = target.refreshInterval || 2;
    
    // 构建查询参数
    const params: {
      targetKey: string;
      startTime?: string;
      endTime?: string;
    } = {
      targetKey: queryForm.targetKey,
    };
    
    if (queryForm.timeRange && queryForm.timeRange[0] && queryForm.timeRange[1]) {
      params.startTime = queryForm.timeRange[0].format('YYYY-MM-DD HH:mm:ss');
      params.endTime = queryForm.timeRange[1].format('YYYY-MM-DD HH:mm:ss');
    }
    
    // 从数据库获取监控日志
    const logs = await fetchMonitorLogs(params);
    
    const tableData: {
      key: string;
      name: string;
      address: string;
      status: string;
      rtt: number;
      time: string;
      shortTime: string;
    }[] = [];
    const chartData: { time: string; rtt: number; status: string; fullTime: string }[] = [];
    
    if (logs && logs.length > 0) {
      // 使用数据库中的真实数据
      logs.forEach((log: any, index: number) => {
        const createdAt = new Date(log.createdAt);
        const fullTimeStr = `${createdAt.getFullYear()}-${(createdAt.getMonth() + 1).toString().padStart(2, '0')}-${createdAt.getDate().toString().padStart(2, '0')} ${createdAt.getHours().toString().padStart(2, '0')}:${createdAt.getMinutes().toString().padStart(2, '0')}:${createdAt.getSeconds().toString().padStart(2, '0')}`;
        const shortTimeStr = `${createdAt.getHours().toString().padStart(2, '0')}:${createdAt.getMinutes().toString().padStart(2, '0')}:${createdAt.getSeconds().toString().padStart(2, '0')}`;
        
        tableData.push({
          key: `${index}`,
          name: target.name,
          address: `${target.address}${target.port ? `:${target.port}` : ''}`,
          status: log.status,
          rtt: log.rtt,
          time: fullTimeStr,
          shortTime: shortTimeStr,
        });
        
        chartData.push({
          time: shortTimeStr,
          rtt: log.rtt,
          status: log.status,
          fullTime: fullTimeStr,
        });
      });
      
      console.log('从数据库加载监控数据:', {
        targetName: target.name,
        dataPoints: logs.length,
      });
    } else {
      console.log('数据库中暂无监控数据:', {
        targetName: target.name,
      });
    }
    
    queryResults.value = tableData;
    fullChartData.value = chartData;
    queryPagination.total = tableData.length;
    
    // 收集离线点索引
    offlinePoints.value = chartData
      .map((d, index) => d.status === 'offline' ? index : -1)
      .filter(index => index !== -1);
    currentOfflineIndex.value = 0;
    
    queryLoading.value = false;
    // 查询后定位到开始时间
    nextTick(() => initChart(chartData, true));
  } catch (error: any) {
    console.error('查询监控数据失败:', error);
    queryLoading.value = false;
  }
};

// 定位到下一个离线点
const goToNextOffline = () => {
  if (offlinePoints.value.length === 0 || !chartInstance) return;
  
  const data = fullChartData.value;
  const totalPoints = data.length;
  const windowMs = displayWindow.value * 60 * 1000;
  const totalMs = data.length > 1 ? 
    (new Date(data[data.length - 1].fullTime).getTime() - new Date(data[0].fullTime).getTime()) : 0;
  
  // 获取当前离线点索引
  const offlineIndex = offlinePoints.value[currentOfflineIndex.value];
  
  // 计算该点在数据中的百分比位置
  const pointPercent = (offlineIndex / totalPoints) * 100;
  const windowPercent = totalMs > 0 ? (windowMs / totalMs) * 100 : 100;
  
  // 将离线点定位到窗口中间
  let startPercent = pointPercent - windowPercent / 2;
  startPercent = Math.max(0, Math.min(100 - windowPercent, startPercent));
  
  chartInstance.dispatchAction({
    type: 'dataZoom',
    start: startPercent,
    end: startPercent + windowPercent,
  });
  
  // 移动到下一个离线点（循环）
  currentOfflineIndex.value = (currentOfflineIndex.value + 1) % offlinePoints.value.length;
};

// 监听显示窗口变化，重新渲染图表（保持当前位置）
watch(displayWindow, () => {
  if (fullChartData.value.length > 0 && chartInstance) {
    // 获取当前的 dataZoom 位置
    const option = chartInstance.getOption() as any;
    const currentStart = option.dataZoom?.[0]?.start ?? 0;
    
    // 重新初始化图表
    initChart(fullChartData.value, false);
    
    // 恢复到之前的位置（调整窗口大小）
    const windowMs = displayWindow.value * 60 * 1000;
    const data = fullChartData.value;
    const totalMs = data.length > 1 ? 
      (new Date(data[data.length - 1].fullTime).getTime() - new Date(data[0].fullTime).getTime()) : 0;
    const windowPercent = totalMs > 0 ? (windowMs / totalMs) * 100 : 100;
    
    chartInstance?.dispatchAction({
      type: 'dataZoom',
      start: currentStart,
      end: Math.min(100, currentStart + windowPercent),
    });
  }
});

// 重置查询
const handleReset = () => {
  queryForm.targetKey = undefined;
  queryForm.timeRange = null;
  queryResults.value = [];
  fullChartData.value = [];
  offlinePoints.value = [];
  currentOfflineIndex.value = 0;
  queryPagination.current = 1;
  queryPagination.total = 0;
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
};

// 表格分页变化
const handleTableChange = (pagination: { current: number; pageSize: number }) => {
  queryPagination.current = pagination.current;
  queryPagination.pageSize = pagination.pageSize;
};

// 监听主题变化
watch(isDark, () => {
  if (fullChartData.value.length > 0 && chartInstance) {
    initChart(fullChartData.value);
  }
});

// 状态刷新定时器
let statusRefreshTimer: ReturnType<typeof setInterval> | null = null;

// 自动刷新状态
const startStatusRefresh = () => {
  stopStatusRefresh();
  statusRefreshTimer = setInterval(refreshTargetStatus, 1000);
};

const stopStatusRefresh = () => {
  if (statusRefreshTimer) {
    clearInterval(statusRefreshTimer);
    statusRefreshTimer = null;
  }
};

const refreshTargetStatus = async () => {
  // 并行ping所有目标，获取实时状态
  const pingPromises = monitorTargets.value.map(async (target) => {
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
      target.status = result.status || 'offline';
      target.rtt = result.rtt || 0;
    } catch {
      target.status = 'offline';
      target.rtt = 0;
    }
  });
  
  // 并行执行所有ping，不阻塞
  await Promise.all(pingPromises);
};

// 页面加载
onMounted(async () => {
  await loadTargetsToStore();
  startStatusRefresh();
});

onUnmounted(() => {
  if (chartInstance) chartInstance.dispose();
  if (timePanelObserver) timePanelObserver.disconnect();
  stopStatusRefresh();
});

// 时间选择器相关
const onPickerOpenChange = (open: boolean) => {
  if (open) {
    setTimeout(() => {
      scrollTimePanelToCenter();
      observeTimePanel();
    }, 100);
  }
};

let timePanelObserver: MutationObserver | null = null;

const observeTimePanel = () => {
  if (timePanelObserver) timePanelObserver.disconnect();
  
  const panel = document.querySelector('.time-picker-centered .ant-picker-time-panel');
  if (!panel) return;
  
  timePanelObserver = new MutationObserver(() => {
    setTimeout(() => scrollTimePanelToCenter(), 150);
  });
  
  timePanelObserver.observe(panel, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });
};

const scrollTimePanelToCenter = () => {
  const columns = document.querySelectorAll('.time-picker-centered .ant-picker-time-panel-column');
  columns.forEach((column) => {
    const selected = column.querySelector('.ant-picker-time-panel-cell-selected') as HTMLElement;
    if (selected && column instanceof HTMLElement) {
      const columnHeight = column.clientHeight;
      const itemHeight = selected.offsetHeight;
      const itemTop = selected.offsetTop;
      const scrollTop = itemTop - (columnHeight / 2) + (itemHeight / 2);
      column.scrollTop = Math.max(0, scrollTop);
    }
  });
};
</script>

<style>
.time-picker-centered .ant-picker-time-panel-column {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.time-picker-centered .ant-picker-time-panel-column::-webkit-scrollbar {
  display: none;
  width: 0;
}

.time-picker-centered .ant-picker-time-panel-column > li.ant-picker-time-panel-cell-selected .ant-picker-time-panel-cell-inner {
  background-color: #1890ff !important;
  color: #fff !important;
}

.time-picker-centered .ant-picker-time-panel-column > li.ant-picker-time-panel-cell .ant-picker-time-panel-cell-inner:hover {
  background-color: rgba(24, 144, 255, 0.4) !important;
}
</style>
