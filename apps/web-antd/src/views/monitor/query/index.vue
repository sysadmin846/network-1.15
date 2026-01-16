<template>
  <Page title="数据查询" description="查询监控对象的历史数据">
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

import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { usePreferences } from '@vben/preferences';

import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { Badge, Button, DatePicker, Select, SelectOption, Table } from 'ant-design-vue';

const { RangePicker } = DatePicker;
import * as echarts from 'echarts';

import { defaultTargets } from '../data/targets';

const { isDark } = usePreferences();

// 使用共享的监控对象列表
const monitorTargets = computed(() => defaultTargets);

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
}));

// 获取 RTT 样式类
const getRttClass = (rtt: number, status?: string): string => {
  if (status === 'offline') return 'text-red-500 font-medium';
  if (rtt >= 100) return 'text-red-500 font-medium';
  if (rtt >= 50) return 'text-yellow-500 font-medium';
  return 'text-green-500 font-medium';
};

// 初始化图表 - 根据状态显示不同颜色
const initChart = (data: { time: string; rtt: number; status: string }[]) => {
  if (!queryChartRef.value) return;
  if (chartInstance) chartInstance.dispose();
  chartInstance = echarts.init(queryChartRef.value);
  const colors = chartColors.value;
  
  // 根据状态和RTT值设置每个点的颜色
  const getPointColor = (status: string, rtt: number) => {
    if (status === 'offline') return '#ef4444'; // 红色 - 离线
    if (rtt >= 100) return '#ef4444'; // 红色 - 高延迟
    if (rtt >= 50) return '#eab308'; // 黄色 - 中等延迟
    return '#22c55e'; // 绿色 - 正常
  };

  // 为每个数据点设置颜色
  const seriesData = data.map((d) => ({
    value: d.status === 'offline' ? 0 : d.rtt,
    itemStyle: { color: getPointColor(d.status, d.rtt) },
  }));

  // 创建分段的线条颜色
  const pieces = data.map((d, index) => ({
    gt: index - 1,
    lte: index,
    color: getPointColor(d.status, d.rtt),
  }));

  const option: echarts.EChartsOption = {
    title: { text: 'RTT 趋势图', left: 'center', textStyle: { color: colors.tooltipText, fontSize: 14 } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
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
    series: [{
      name: 'RTT',
      type: 'line',
      smooth: true,
      data: seriesData,
      lineStyle: { width: 2 },
      symbol: 'circle',
      symbolSize: 6,
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
        return `${item.time}<br/>
          状态: <span style="color:${statusColor}">${statusText}</span><br/>
          RTT: <span style="color:${getPointColor(item.status, item.rtt)}">${item.status === 'offline' ? '未响应' : item.rtt + ' ms'}</span>`;
      },
    },
  };
  chartInstance.setOption(option);
};

// 查询处理
const handleQuery = () => {
  if (!queryForm.targetKey) return;
  queryLoading.value = true;
  const target = monitorTargets.value.find((t) => t.key === queryForm.targetKey);
  if (!target) {
    queryLoading.value = false;
    return;
  }
  
  setTimeout(() => {
    const mockData = [];
    const isOfflineTarget = target.status === 'offline';
    // 使用监控对象的刷新间隔（秒转毫秒）
    const refreshInterval = (target.refreshInterval || 2) * 1000;
    
    // 使用用户选择的时间范围，如果没有选择则使用当前时间往前推
    let startTime: number;
    let endTime: number;
    
    if (queryForm.timeRange && queryForm.timeRange[0] && queryForm.timeRange[1]) {
      startTime = queryForm.timeRange[0].valueOf();
      endTime = queryForm.timeRange[1].valueOf();
    } else {
      endTime = Date.now();
      startTime = endTime - 50 * refreshInterval;
    }
    
    // 根据时间范围和刷新间隔计算数据点数量
    const dataPoints = Math.min(Math.floor((endTime - startTime) / refreshInterval), 200);
    
    for (let i = 0; i < dataPoints; i++) {
      // 从开始时间递增
      const time = new Date(startTime + i * refreshInterval);
      // 完整时间格式：年-月-日 时:分:秒（用于表格）
      const fullTimeStr = `${time.getFullYear()}-${(time.getMonth() + 1).toString().padStart(2, '0')}-${time.getDate().toString().padStart(2, '0')} ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
      // 简短时间格式：时:分:秒（用于图表）
      const shortTimeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
      
      // 根据目标状态生成数据
      let status: string;
      let rtt: number;
      
      if (isOfflineTarget) {
        // 离线目标：全部显示离线
        status = 'offline';
        rtt = 0;
      } else {
        // 在线目标：随机生成一些离线点模拟网络波动
        status = Math.random() > 0.1 ? 'online' : 'offline';
        rtt = status === 'offline' ? 0 : Math.floor(Math.random() * 80) + 20;
      }
      
      mockData.push({
        key: `${i}`,
        name: target.name,
        address: `${target.address}${target.port ? `:${target.port}` : ''}`,
        status,
        rtt,
        time: fullTimeStr,
        shortTime: shortTimeStr,
      });
    }
    queryResults.value = mockData;
    queryPagination.total = mockData.length;
    queryLoading.value = false;
    // 图表使用简短时间
    nextTick(() => initChart(mockData.map((d) => ({ time: d.shortTime, rtt: d.rtt, status: d.status }))));
  }, 500);
};

// 重置查询
const handleReset = () => {
  queryForm.targetKey = undefined;
  queryForm.timeRange = null;
  queryResults.value = [];
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
  if (queryResults.value.length > 0 && chartInstance) {
    initChart(queryResults.value.map((d) => ({ time: d.shortTime, rtt: d.rtt, status: d.status })));
  }
});

onUnmounted(() => {
  if (chartInstance) chartInstance.dispose();
  if (timePanelObserver) timePanelObserver.disconnect();
});

// 时间选择器打开时，将选中项滚动到居中位置
const onPickerOpenChange = (open: boolean) => {
  if (open) {
    // 等待面板渲染完成
    setTimeout(() => {
      scrollTimePanelToCenter();
      // 使用 MutationObserver 监听选中状态变化
      observeTimePanel();
    }, 100);
  }
};

// 使用 MutationObserver 监听时间面板选中状态变化
let timePanelObserver: MutationObserver | null = null;

const observeTimePanel = () => {
  // 清理旧的观察器
  if (timePanelObserver) {
    timePanelObserver.disconnect();
  }
  
  const panel = document.querySelector('.time-picker-centered .ant-picker-time-panel');
  if (!panel) return;
  
  timePanelObserver = new MutationObserver(() => {
    // 选中状态变化后居中，延迟更长时间确保在 Ant Design 滚动之后执行
    setTimeout(() => {
      scrollTimePanelToCenter();
    }, 150);
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
      // 计算居中位置
      const scrollTop = itemTop - (columnHeight / 2) + (itemHeight / 2);
      // 直接设置 scrollTop，不使用 smooth 避免与 Ant Design 冲突
      column.scrollTop = Math.max(0, scrollTop);
    }
  });
};
</script>



<style>
/* 时间选择器居中样式 */
.time-picker-centered .ant-picker-time-panel-column {
  /* 隐藏滚动条 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.time-picker-centered .ant-picker-time-panel-column::-webkit-scrollbar {
  display: none;
  width: 0;
}

/* 选中项高亮 */
.time-picker-centered .ant-picker-time-panel-column > li.ant-picker-time-panel-cell-selected .ant-picker-time-panel-cell-inner {
  background-color: #1890ff !important;
  color: #fff !important;
}

/* hover 效果 */
.time-picker-centered .ant-picker-time-panel-column > li.ant-picker-time-panel-cell .ant-picker-time-panel-cell-inner:hover {
  background-color: rgba(24, 144, 255, 0.4) !important;
}
</style>
