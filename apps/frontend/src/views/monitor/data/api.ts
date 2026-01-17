// 监控数据 API
import { sharedTargets, isLoaded } from './store';
import type { MonitorTarget } from './targets';

// 获取所有监控目标
export async function fetchTargets() {
  const res = await fetch('/api/monitor/targets');
  const data = await res.json();
  if (data.code === 0) {
    return data.data || [];
  }
  throw new Error(data.message || '获取监控目标失败');
}

// 加载监控目标到共享状态（各页面调用）
export async function loadTargetsToStore() {
  if (isLoaded.value && sharedTargets.value.length > 0) {
    return; // 已加载过，不重复加载
  }
  
  try {
    await initDatabase();
    const targets = await fetchTargets();
    
    if (targets && targets.length > 0) {
      sharedTargets.value = targets.map((t: any) => ({
        key: t.key,
        name: t.name,
        address: t.address,
        protocol: t.protocol,
        port: t.port,
        status: t.status || 'online',
        rtt: t.rtt || 0,
        remark: t.remark || '',
        refreshInterval: t.refreshInterval || 2,
        maxRtt: t.maxRtt || 100,
        rttHistory: [],
        timeLabels: [],
      })) as MonitorTarget[];
    }
    isLoaded.value = true;
  } catch (error) {
    console.error('加载监控目标失败:', error);
  }
}

// 保存监控目标
export async function saveTarget(target: {
  key: string;
  name: string;
  address: string;
  protocol: string;
  port: number | null;
  remark: string;
  refreshInterval: number;
  maxRtt: number;
}) {
  const res = await fetch('/api/monitor/targets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target),
  });
  const data = await res.json();
  if (data.code === 0) {
    return data.data;
  }
  throw new Error(data.message || '保存监控目标失败');
}

// 删除监控目标
export async function deleteTarget(key: string) {
  const res = await fetch(`/api/monitor/targets/${key}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (data.code === 0) {
    return true;
  }
  throw new Error(data.message || '删除监控目标失败');
}

// 记录监控日志
export async function saveMonitorLog(log: {
  targetKey: string;
  targetName?: string;
  rtt: number;
  status: string;
  refreshInterval?: number;
}) {
  const res = await fetch('/api/monitor/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(log),
  });
  const data = await res.json();
  if (data.code === 0) {
    return true;
  }
  throw new Error(data.message || '记录监控日志失败');
}

// 获取监控日志
export async function fetchMonitorLogs(params: {
  targetKey: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  query.set('targetKey', params.targetKey);
  if (params.startTime) query.set('startTime', params.startTime);
  if (params.endTime) query.set('endTime', params.endTime);
  if (params.limit) query.set('limit', params.limit.toString());
  
  const res = await fetch(`/api/monitor/logs?${query.toString()}`);
  const data = await res.json();
  if (data.code === 0) {
    return data.data || [];
  }
  throw new Error(data.message || '获取监控日志失败');
}

// 初始化数据库
export async function initDatabase() {
  const res = await fetch('/api/monitor/init', {
    method: 'POST',
  });
  const data = await res.json();
  if (data.code === 0) {
    return true;
  }
  throw new Error(data.message || '初始化数据库失败');
}
