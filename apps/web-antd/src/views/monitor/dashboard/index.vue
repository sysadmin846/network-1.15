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
        <!-- 搜索和添加按钮 -->
        <Input
          v-model:value="searchKeyword"
          placeholder="搜索名称/地址"
          style="width: 180px"
          allow-clear
          size="small"
        >
          <template #prefix><SearchOutlined /></template>
        </Input>
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

import { type MonitorTarget, initTargets } from '../data/targets';

const { isDark } = usePreferences();

// 监控目标数据
const monitorTargets = ref<MonitorTarget[]>(initTargets());

// 搜索关键词
const searchKeyword = ref('');

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
  });
  modalVisible.value = true;
};

const handleDeleteTarget = (record: MonitorTarget) => {
  const chart = chartInstances.get(record.key);
  if (chart) {
    chart.dispose();
    chartInstances.delete(record.key);
  }
  chartRefs.delete(record.key);
  stopTimer(record.key);
  monitorTargets.value = monitorTargets.value.filter((item) => item.key !== record.key);
  message.success('删除成功');
};

const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
    if (isEdit.value) {
      const index = monitorTargets.value.findIndex((item) => item.key === formData.key);
      if (index > -1) {
        const existingTarget = monitorTargets.value[index];
        if (!existingTarget) return;
        
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
          rttHistory: existingTarget.rttHistory,
          timeLabels: existingTarget.timeLabels,
        };
        // 重新启动定时器以应用新的刷新间隔
        const target = monitorTargets.value[index];
        if (target) {
          startTimer(target);
        }
      }
      message.success('编辑成功');
    } else {
      const newKey = Date.now().toString();
      monitorTargets.value.push({
        key: newKey,
        name: formData.name,
        address: formData.address,
        protocol: formData.protocol,
        port: formData.port,
        status: 'online',
        rtt: Math.floor(Math.random() * 40) + 30,
        remark: formData.remark,
        refreshInterval: formData.refreshInterval,
        rttHistory: [],
        timeLabels: [],
      });
      message.success('添加成功');
      // 延迟初始化新图表
      setTimeout(() => {
        const newTarget = monitorTargets.value.find(t => t.key === newKey);
        if (newTarget) {
          initHistoryData(newKey);
          initChartForTarget(newKey);
          startTimer(newTarget);
        }
      }, 100);
    }
    modalVisible.value = false;
  } catch {
    // 表单验证失败
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

// 生成RTT数据
const generateRtt = (status: string): number => {
  return status === 'offline' ? 0 : Math.floor(Math.random() * 40) + 30;
};

// 追加数据点到目标（统一的数据处理逻辑）
const appendPoint = (target: MonitorTarget, timestamp?: number) => {
  const time = timestamp || Date.now();
  const timeStr = generateTimeStr(time);
  const rtt = generateRtt(target.status);

  target.rtt = rtt;
  target.rttHistory.push(rtt);
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

  const colors = chartColors.value;
  const option: echarts.EChartsOption = {
    // 开启动画，实现滑动效果
    animation: true,
    animationDuration: 300,
    animationDurationUpdate: 300,
    animationEasing: 'linear',
    animationEasingUpdate: 'linear',
    grid: { left: 50, right: 20, bottom: 30, top: 10 },
    xAxis: {
      type: 'category',
      data: target.timeLabels,
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
      max: 100,
    },
    series: [{
      type: 'line',
      smooth: 0.3,
      data: target.rttHistory,
      lineStyle: { color: '#1890ff', width: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
          { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
        ]),
      },
      itemStyle: { color: '#1890ff' },
      symbol: 'none',
    }],
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.tooltipBg,
      borderColor: colors.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: colors.tooltipText, fontSize: 12 },
      formatter: (params: any) => `${params[0].axisValue}<br/>RTT: ${params[0].value} ms`,
    },
  };
  chart.setOption(option);
};

// 初始化历史数据（通过循环调用 appendPoint）
const initHistoryData = (key: string) => {
  const target = monitorTargets.value.find((t) => t.key === key);
  if (!target) return;
  
  const refreshInterval = target.refreshInterval * 1000;
  const now = Date.now();
  
  // 使用固定数据点数量初始化，确保最后一个点是当前时间
  for (let i = 0; i < DATA_POINTS; i++) {
    const timestamp = now - (DATA_POINTS - 1 - i) * refreshInterval;
    appendPoint(target, timestamp);
  }
};

// 更新单个目标的图表（滑动效果）
const updateSingleTarget = (target: MonitorTarget) => {
  // 追加新数据点，移除最旧的点
  appendPoint(target);

  const chart = chartInstances.get(target.key);
  if (chart) {
    // 使用 notMerge: false 实现平滑过渡动画
    chart.setOption({
      xAxis: { data: [...target.timeLabels] },
      series: [{ data: [...target.rttHistory] }],
    }, {
      notMerge: false,
      lazyUpdate: false,
    });
  }
};

// 为每个目标维护独立的定时器
const targetTimers = new Map<string, ReturnType<typeof setInterval>>();

// 启动所有目标的定时器
const startAllTimers = () => {
  monitorTargets.value.forEach((target) => {
    startTimer(target);
  });
};

// 启动单个目标的定时器
const startTimer = (target: MonitorTarget) => {
  const existingTimer = targetTimers.get(target.key);
  if (existingTimer) {
    clearInterval(existingTimer);
  }
  
  const timer = setInterval(() => {
    updateSingleTarget(target);
  }, target.refreshInterval * 1000);
  
  targetTimers.set(target.key, timer);
};

// 停止单个目标的定时器
const stopTimer = (key: string) => {
  const timer = targetTimers.get(key);
  if (timer) {
    clearInterval(timer);
    targetTimers.delete(key);
  }
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
  
  // 分批重新初始化当前显示的图表
  batchInitCharts(newTargets);
});

// 分批初始化图表，避免一次性渲染过多导致卡顿
const batchInitCharts = (targets: MonitorTarget[], batchSize = 3) => {
  let index = 0;
  
  const initBatch = () => {
    const batch = targets.slice(index, index + batchSize);
    batch.forEach((target) => {
      initChartForTarget(target.key);
    });
    index += batchSize;
    
    if (index < targets.length) {
      requestAnimationFrame(initBatch);
    }
  };
  
  requestAnimationFrame(initBatch);
};

onMounted(() => {
  // 先初始化所有目标的历史数据
  monitorTargets.value.forEach((target) => {
    initHistoryData(target.key);
  });

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
  targetTimers.forEach((timer) => clearInterval(timer));
  targetTimers.clear();
  chartInstances.forEach((chart) => chart.dispose());
  chartInstances.clear();
});
</script>
