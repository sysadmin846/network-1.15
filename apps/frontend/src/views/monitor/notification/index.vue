<template>
  <Page title="通知配置" description="配置告警通知规则和测试短信发送">
    <template #extra>
      <div class="flex items-center gap-4">
        <Button size="small" :loading="syncing" @click="handleSyncData">
          <template #icon><SyncOutlined /></template>
          同步
        </Button>
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <InfoCircleOutlined />
          <span>告警配置与测试短信相互独立，互不影响</span>
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <!-- 监控目标选择卡片 -->
      <div class="bg-card rounded-lg p-4 shadow-sm">
        <div class="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-2">
            <AimOutlined class="text-lg text-blue-500" />
            <span class="text-lg font-semibold">告警监控目标</span>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <span class="text-muted-foreground">已选择</span>
            <Tag color="blue">{{ selectedTargets.length }} / {{ monitorTargets.length }}</Tag>
          </div>
        </div>

        <Alert
          message="选择需要告警的监控目标"
          description="只有被选中的监控目标在异常时才会发送告警通知，未选中的目标不会触发告警。"
          type="info"
          show-icon
          class="mb-4"
        />

        <div class="mb-3 flex items-center gap-2">
          <Button size="small" @click="selectAllTargets">全选</Button>
          <Button size="small" @click="deselectAllTargets">全不选</Button>
          <span class="ml-2 text-sm text-muted-foreground">
            共 {{ monitorTargets.length }} 个监控目标
          </span>
        </div>

        <CheckboxGroup v-model:value="selectedTargets" class="w-full">
          <div class="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="target in monitorTargets"
              :key="target.key"
              class="flex items-center gap-2 rounded border border-border p-2 hover:bg-accent/50"
              :class="{ 'border-primary bg-primary/5': selectedTargets.includes(target.key) }"
            >
              <Checkbox :value="target.key" />
              <div class="flex flex-1 items-center justify-between">
                <div class="flex flex-col">
                  <span class="font-medium">{{ target.name }}</span>
                  <span class="text-xs text-muted-foreground">{{ target.address }}</span>
                </div>
                <Tag :color="target.status === 'online' ? 'green' : 'red'" size="small">
                  {{ target.status === 'online' ? '在线' : '离线' }}
                </Tag>
              </div>
            </div>
          </div>
        </CheckboxGroup>
      </div>

      <!-- 告警配置卡片 -->
      <div class="bg-card rounded-lg p-4 shadow-sm">
        <div class="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-2">
            <BellOutlined class="text-lg text-primary" />
            <span class="text-lg font-semibold">告警通知配置</span>
          </div>
          <div class="flex items-center gap-3">
            <Button size="small" @click="openTestSmsModal">
              <template #icon><MessageOutlined /></template>
              短信测试
            </Button>
            <Badge status="processing" text="监控中" v-if="alertConfig.enabled && isMonitoring" />
            <Badge status="success" text="已启用" v-else-if="alertConfig.enabled" />
            <Badge status="default" text="已禁用" v-else />
          </div>
        </div>

        <Form :model="alertConfig" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormItem label="启用告警">
              <Switch v-model:checked="alertConfig.enabled" />
            </FormItem>
            <FormItem label="连续异常次数">
              <InputNumber v-model:value="alertConfig.consecutiveFailures" :min="1" :max="10" />
              <span class="ml-2 text-muted-foreground">次后触发告警（持续离线只通知一次）</span>
            </FormItem>
            <FormItem label="恢复通知">
              <Switch v-model:checked="alertConfig.notifyOnRecovery" />
              <span class="ml-2 text-muted-foreground">故障恢复后发送通知</span>
            </FormItem>
          </div>

          <Divider>通知渠道</Divider>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormItem label="短信通知">
              <Switch v-model:checked="alertConfig.channels.sms" />
            </FormItem>
            <FormItem label="通知手机号" v-if="alertConfig.channels.sms">
              <Input v-model:value="alertConfig.smsPhone" placeholder="请输入接收告警的手机号" />
            </FormItem>
          </div>

          <div class="mt-4 flex items-center justify-between">
            <div class="text-sm text-muted-foreground" v-if="alertConfig.updatedAt">
              上次保存: {{ alertConfig.updatedAt }}
            </div>
            <div class="flex gap-2">
              <Button @click="resetAlertConfig">重置</Button>
              <Button type="primary" :loading="saving" @click="saveAlertConfig">
                <template #icon><SaveOutlined /></template>
                保存并启动监控
              </Button>
            </div>
          </div>
        </Form>
      </div>

      <!-- 短信测试弹窗 -->
      <Modal
        v-model:open="testSmsModalVisible"
        title="发送测试短信"
        @ok="sendTestSms"
        :confirmLoading="testSms.sending"
        okText="发送"
        cancelText="取消"
      >
        <Form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }">
          <FormItem label="手机号" required>
            <Input v-model:value="testSmsForm.phone" placeholder="请输入接收短信的手机号" />
          </FormItem>
          <FormItem label="短信内容">
            <Textarea 
              v-model:value="testSmsForm.content" 
              placeholder="请输入短信内容（可选，留空则发送默认测试内容）" 
              :rows="4"
            />
          </FormItem>
        </Form>
        <div v-if="testSms.lastSendTime" class="mt-4 text-sm text-muted-foreground">
          上次发送: {{ testSms.lastSendTime }}
          <span :class="testSms.lastResult === 'success' ? 'text-green-500' : 'text-red-500'">
            ({{ testSms.lastResult === 'success' ? '成功' : '失败' }})
          </span>
        </div>
      </Modal>

      <!-- 告警记录卡片 -->
      <div class="bg-card rounded-lg p-4 shadow-sm">
        <div class="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-2">
            <HistoryOutlined class="text-lg" />
            <span class="text-lg font-semibold">告警记录</span>
          </div>
          <Button size="small" @click="fetchAlertLogs" :loading="alertLogsLoading">
            <template #icon><ReloadOutlined /></template>
            刷新
          </Button>
        </div>

        <!-- 查询条件 -->
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <Select v-model:value="alertLogFilter.type" style="width: 120px" size="small" placeholder="类型">
            <SelectOption value="all">全部类型</SelectOption>
            <SelectOption value="alert">告警</SelectOption>
            <SelectOption value="recovery">恢复</SelectOption>
          </Select>
          <Select 
            v-model:value="alertLogFilter.targetKey" 
            style="width: 150px" 
            size="small" 
            placeholder="监控目标"
            allowClear
          >
            <SelectOption value="">全部目标</SelectOption>
            <SelectOption v-for="t in monitorTargets" :key="t.key" :value="t.key">
              {{ t.name }}
            </SelectOption>
          </Select>
          <RangePicker 
            v-model:value="alertLogFilter.dateRange" 
            size="small" 
            style="width: 240px"
            :placeholder="['开始日期', '结束日期']"
          />
          <Button size="small" type="primary" @click="fetchAlertLogs">查询</Button>
          <Button size="small" @click="resetAlertLogFilter">重置</Button>
        </div>

        <Table
          :columns="alertLogColumns"
          :data-source="alertLogs"
          :pagination="alertLogPagination"
          :loading="alertLogsLoading"
          size="small"
          @change="handleAlertLogTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'type'">
              <Tag :color="record.type === 'alert' ? 'red' : 'green'">
                {{ record.type === 'alert' ? '告警' : '恢复' }}
              </Tag>
            </template>
            <template v-if="column.key === 'target'">
              <div>
                <div class="font-medium">{{ record.targetName }}</div>
                <div class="text-xs text-muted-foreground">{{ record.targetAddress }}</div>
              </div>
            </template>
            <template v-if="column.key === 'smsStatus'">
              <Badge
                :status="record.smsStatus === 'sent' ? 'success' : record.smsStatus === 'skipped' ? 'default' : 'error'"
                :text="record.smsStatus === 'sent' ? '已发送' : record.smsStatus === 'skipped' ? '未发送' : '失败'"
              />
            </template>
            <template v-if="column.key === 'content'">
              <Tooltip :title="record.content">
                <span class="cursor-pointer">{{ truncateText(record.content, 40) }}</span>
              </Tooltip>
            </template>
          </template>
        </Table>
      </div>
    </div>
  </Page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import type { Dayjs } from 'dayjs';

import { Page } from '@vben/common-ui';

import {
  AimOutlined,
  BellOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  MessageOutlined,
  ReloadOutlined,
  SaveOutlined,
  SendOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  CheckboxGroup,
  DatePicker,
  Divider,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  SelectOption,
  Switch,
  Table,
  Tag,
  Textarea,
  Tooltip,
} from 'ant-design-vue';

import { sharedTargets, isLoaded } from '../data/store';
import { loadTargetsToStore } from '../data/api';

const { RangePicker } = DatePicker;

// ==================== 监控目标选择 ====================
const monitorTargets = sharedTargets;
const selectedTargets = ref<string[]>([]);

// 同步状态
const syncing = ref(false);

// 同步数据
const handleSyncData = async () => {
  syncing.value = true;
  try {
    // 强制重新加载
    isLoaded.value = false;
    await loadTargetsToStore();
    // 刷新告警日志
    await fetchAlertLogs();
  } finally {
    syncing.value = false;
  }
};

const selectAllTargets = () => {
  selectedTargets.value = monitorTargets.value.map(t => t.key);
};

const deselectAllTargets = () => {
  selectedTargets.value = [];
};

// ==================== 告警配置 ====================
const alertConfig = reactive({
  enabled: false,
  consecutiveFailures: 3,  // 默认连续3次离线后触发
  notifyOnRecovery: true,
  smsPhone: '',
  channels: { sms: true, inApp: true, email: false },
  updatedAt: '',
});

const saving = ref(false);
const isMonitoring = ref(false);

// 告警状态跟踪（从数据库加载，持久化存储）
const alertState = reactive<Record<string, {
  failureCount: number;
  isAlerting: boolean;      // 是否已发送告警（持续离线期间只发一次）
  offlineStartTime: string; // 断线开始时间
  lastStatus: string;       // 上次状态（用于检测状态转换）
}>>({});

// 状态刷新定时器（同时负责告警检查）
let statusRefreshTimer: ReturnType<typeof setInterval> | null = null;

const loadAlertConfig = async () => {
  try {
    const res = await fetch('/api/alert/config');
    const result = await res.json();
    if (result.success && result.data) {
      Object.assign(alertConfig, result.data);
      selectedTargets.value = result.data.selectedTargets || [];
      // 如果告警已启用，自动启动监控
      if (alertConfig.enabled && selectedTargets.value.length > 0) {
        startMonitoring();
        console.log('自动启动告警监控');
      }
    }
  } catch {}
};

// 自动刷新状态（让页面显示实时状态，并检查告警）
const startStatusRefresh = () => {
  stopStatusRefresh();
  // 每秒刷新一次状态并检查告警
  statusRefreshTimer = setInterval(refreshAndCheckStatus, 1000);
  // 立即执行一次
  refreshAndCheckStatus();
};

const stopStatusRefresh = () => {
  if (statusRefreshTimer) {
    clearInterval(statusRefreshTimer);
    statusRefreshTimer = null;
  }
};

// 刷新目标状态并检查告警（合并为一个流程，确保时序正确）
const refreshAndCheckStatus = async () => {
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
  
  // 并行执行所有ping
  await Promise.all(pingPromises);
  
  // ping完成后立即检查告警（确保状态已更新）
  if (alertConfig.enabled && isMonitoring.value) {
    await checkTargetStatus();
  }
};

const saveAlertConfig = async () => {
  if (alertConfig.channels.sms && !alertConfig.smsPhone) {
    message.warning('请输入通知手机号');
    return;
  }
  if (alertConfig.channels.sms && !/^1[3-9]\d{9}$/.test(alertConfig.smsPhone)) {
    message.warning('请输入正确的手机号');
    return;
  }
  if (alertConfig.enabled && selectedTargets.value.length === 0) {
    message.warning('请至少选择一个监控目标');
    return;
  }

  saving.value = true;
  try {
    const res = await fetch('/api/alert/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...alertConfig,
        selectedTargets: selectedTargets.value,
      }),
    });
    const result = await res.json();
    if (result.success) {
      alertConfig.updatedAt = result.data.updatedAt;
      // 重置告警状态并重新启动监控
      resetAlertState();
      if (alertConfig.enabled) {
        startMonitoring();
        message.success(`配置已保存，开始监控 ${selectedTargets.value.length} 个目标`);
      } else {
        stopMonitoring();
        message.success('配置已保存，告警已禁用');
      }
    } else {
      message.error(result.error || '保存失败');
    }
  } catch (e: any) {
    message.error(e.message || '保存失败');
  } finally {
    saving.value = false;
  }
};

const resetAlertConfig = () => {
  alertConfig.enabled = false;
  alertConfig.consecutiveFailures = 3;
  alertConfig.notifyOnRecovery = true;
  alertConfig.smsPhone = '';
  alertConfig.channels.sms = true;
  alertConfig.channels.inApp = true;
  alertConfig.channels.email = false;
  selectedTargets.value = [];
  stopMonitoring();
  message.info('已重置为默认配置');
};

const resetAlertState = async () => {
  // 清空内存中的状态
  for (const key of Object.keys(alertState)) {
    delete alertState[key];
  }
  
  // 清空数据库中的状态
  try {
    for (const targetKey of selectedTargets.value) {
      await fetch(`/api/alert/state?targetKey=${targetKey}`, {
        method: 'DELETE',
      });
    }
  } catch (error) {
    console.error('清空数据库告警状态失败:', error);
  }
};

// ==================== 告警监控逻辑 ====================
const startMonitoring = () => {
  stopMonitoring();
  isMonitoring.value = true;
  // 告警检查现在由 refreshAndCheckStatus 统一处理
  // 不再需要单独的定时器
  console.log('告警监控已启动');
};

const stopMonitoring = () => {
  isMonitoring.value = false;
  console.log('告警监控已停止');
};

const checkTargetStatus = async () => {
  if (!alertConfig.enabled) {
    return;
  }
  
  for (const targetKey of selectedTargets.value) {
    const target = monitorTargets.value.find(t => t.key === targetKey);
    if (!target) continue;
    
    // 从数据库加载或初始化告警状态
    if (!alertState[targetKey]) {
      const dbState = await loadAlertStateFromDB(targetKey);
      if (dbState) {
        alertState[targetKey] = dbState;
      } else {
        alertState[targetKey] = { 
          failureCount: 0, 
          isAlerting: false, 
          offlineStartTime: '',
          lastStatus: target.status,
        };
      }
    }
    
    const state = alertState[targetKey];
    const isOffline = target.status === 'offline';
    const wasOnline = state.lastStatus === 'online';
    const wasOffline = state.lastStatus === 'offline';
    
    console.log(`[${target.name}] 状态=${target.status}, 上次=${state.lastStatus}, 失败次数=${state.failureCount}/${alertConfig.consecutiveFailures}, 已告警=${state.isAlerting}`);
    
    if (isOffline) {
      // 记录首次断线时间
      if (state.failureCount === 0) {
        state.offlineStartTime = new Date().toLocaleString('zh-CN');
        console.log(`[${target.name}] 首次检测到离线，开始计数`);
      }
      state.failureCount++;
      
      // 达到连续异常次数且尚未发送过告警
      if (state.failureCount >= alertConfig.consecutiveFailures && !state.isAlerting) {
        console.log(`[${target.name}] 连续离线 ${state.failureCount} 次，触发告警通知!`);
        await triggerAlert('alert', target, state.offlineStartTime);
        state.isAlerting = true;  // 标记已告警，持续离线期间不再重复
      }
    } else {
      // 恢复在线
      // 只有当之前是离线状态且已发送过告警时，才发送恢复通知
      if (wasOffline && state.isAlerting && alertConfig.notifyOnRecovery) {
        const recoveryTime = new Date().toLocaleString('zh-CN');
        console.log(`[${target.name}] 从离线恢复到在线，触发恢复通知!`);
        await triggerAlert('recovery', target, state.offlineStartTime, recoveryTime);
      }
      // 重置状态，等待下次离线重新计数
      state.failureCount = 0;
      state.isAlerting = false;
      state.offlineStartTime = '';
    }
    
    // 更新上次状态
    state.lastStatus = target.status;
    
    // 保存状态到数据库
    await saveAlertStateToDB(targetKey, state);
  }
};

// 从数据库加载告警状态
const loadAlertStateFromDB = async (targetKey: string) => {
  try {
    const res = await fetch(`/api/alert/state?targetKey=${targetKey}`);
    const result = await res.json();
    if (result.success && result.data) {
      return result.data;
    }
  } catch (error) {
    console.error('加载告警状态失败:', error);
  }
  return null;
};

// 保存告警状态到数据库
const saveAlertStateToDB = async (targetKey: string, state: any) => {
  try {
    await fetch('/api/alert/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetKey,
        failureCount: state.failureCount,
        isAlerting: state.isAlerting,
        offlineStartTime: state.offlineStartTime,
        lastStatus: state.lastStatus,
      }),
    });
  } catch (error) {
    console.error('保存告警状态失败:', error);
  }
};

const triggerAlert = async (type: 'alert' | 'recovery', target: any, offlineTime?: string, recoveryTime?: string) => {
  try {
    await fetch('/api/alert/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        targetKey: target.key,
        targetName: target.name,
        targetAddress: target.address,
        phone: alertConfig.channels.sms ? alertConfig.smsPhone : null,
        offlineTime,
        recoveryTime,
      }),
    });
    
    const typeText = type === 'alert' ? '告警' : '恢复';
    message.warning(`${typeText}通知: ${target.name} (${target.address})`);
    
    // 刷新日志
    fetchAlertLogs();
  } catch (e: any) {
    console.error('触发告警失败:', e);
  }
};

// ==================== 测试短信 ====================
const testSmsModalVisible = ref(false);
const testSmsForm = reactive({
  phone: '',
  content: '',
});

const testSms = reactive({
  sending: false,
  cooldown: 0,
  lastSendTime: '',
  lastResult: '' as 'success' | 'failed' | '',
});

let cooldownTimer: ReturnType<typeof setInterval> | null = null;

const openTestSmsModal = () => {
  // 默认使用告警配置的手机号
  testSmsForm.phone = alertConfig.smsPhone || '';
  testSmsForm.content = '';
  testSmsModalVisible.value = true;
};

const sendTestSms = async () => {
  if (!testSmsForm.phone) {
    message.warning('请输入手机号');
    return;
  }
  if (!/^1[3-9]\d{9}$/.test(testSmsForm.phone)) {
    message.warning('请输入正确的手机号');
    return;
  }

  testSms.sending = true;
  try {
    const res = await fetch('/api/sms/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testSmsForm.phone,
        type: 'alert',
        content: testSmsForm.content || '',
      }),
    });
    const result = await res.json();
    
    testSms.lastSendTime = new Date().toLocaleString();
    testSms.lastResult = result.success ? 'success' : 'failed';
    
    if (result.success) {
      message.success('测试短信发送成功');
      testSmsModalVisible.value = false;
    } else {
      message.error(`测试短信发送失败: ${result.error || '未知错误'}`);
    }
  } catch (e: any) {
    message.error(`发送失败: ${e.message || '请稍后重试'}`);
    testSms.lastResult = 'failed';
  } finally {
    testSms.sending = false;
  }
};

// ==================== 告警记录 ====================
const alertLogColumns = [
  { title: '时间', dataIndex: 'time', key: 'time', width: 170 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 80 },
  { title: '监控目标', dataIndex: 'target', key: 'target', width: 180 },
  { title: '内容', dataIndex: 'content', key: 'content' },
  { title: '短信状态', dataIndex: 'smsStatus', key: 'smsStatus', width: 100 },
];

const alertLogs = ref<any[]>([]);
const alertLogsLoading = ref(false);
const alertLogFilter = reactive({
  type: 'all',
  targetKey: '',
  dateRange: null as [Dayjs, Dayjs] | null,
});
const alertLogPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
});

const fetchAlertLogs = async () => {
  alertLogsLoading.value = true;
  try {
    const params = new URLSearchParams({
      page: String(alertLogPagination.current),
      pageSize: String(alertLogPagination.pageSize),
      type: alertLogFilter.type,
    });
    
    if (alertLogFilter.targetKey) {
      params.set('targetKey', alertLogFilter.targetKey);
    }
    if (alertLogFilter.dateRange?.[0]) {
      params.set('startDate', alertLogFilter.dateRange[0].format('YYYY-MM-DD'));
    }
    if (alertLogFilter.dateRange?.[1]) {
      params.set('endDate', alertLogFilter.dateRange[1].format('YYYY-MM-DD'));
    }
    
    const res = await fetch(`/api/alert/logs?${params}`);
    const result = await res.json();
    
    if (result.success) {
      alertLogs.value = result.data.list.map((item: any, idx: number) => ({
        ...item,
        key: item.id || idx,
      }));
      alertLogPagination.total = result.data.total;
    }
  } catch (e: any) {
    message.error(`获取日志失败: ${e.message}`);
  } finally {
    alertLogsLoading.value = false;
  }
};

const handleAlertLogTableChange = (pagination: any) => {
  alertLogPagination.current = pagination.current;
  alertLogPagination.pageSize = pagination.pageSize;
  fetchAlertLogs();
};

const resetAlertLogFilter = () => {
  alertLogFilter.type = 'all';
  alertLogFilter.targetKey = '';
  alertLogFilter.dateRange = null;
  alertLogPagination.current = 1;
  fetchAlertLogs();
};

const truncateText = (text: string, maxLength: number) => {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
};

// ==================== 生命周期 ====================
onMounted(async () => {
  // 从数据库加载监控目标
  await loadTargetsToStore();
  loadAlertConfig();
  fetchAlertLogs();
  // 启动状态自动刷新
  startStatusRefresh();
});

onUnmounted(() => {
  stopMonitoring();
  stopStatusRefresh();
  if (cooldownTimer) clearInterval(cooldownTimer);
});
</script>
