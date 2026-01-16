// 监控目标数据
export interface MonitorTarget {
  key: string;
  name: string;
  address: string;
  protocol: string;
  port: number | null;
  status: string;
  rtt: number;
  remark: string;
  refreshInterval: number;
  rttHistory: number[];
  timeLabels: string[];
}

// 默认监控目标列表
export const defaultTargets: Omit<MonitorTarget, 'rttHistory' | 'timeLabels'>[] = [
  {
    key: '1',
    name: '主服务器',
    address: '192.168.1.100',
    protocol: 'ICMP',
    port: null,
    status: 'online',
    rtt: 45,
    remark: '生产环境主服务器',
    refreshInterval: 2,
  },
  {
    key: '2',
    name: '数据库服务器',
    address: '192.168.1.102',
    protocol: 'TCP',
    port: 3306,
    status: 'online',
    rtt: 38,
    remark: 'MySQL数据库',
    refreshInterval: 2,
  },
  {
    key: '3',
    name: 'Redis缓存',
    address: '192.168.1.103',
    protocol: 'TCP',
    port: 6379,
    status: 'online',
    rtt: 12,
    remark: 'Redis缓存服务器',
    refreshInterval: 2,
  },
  {
    key: '4',
    name: 'Nginx网关',
    address: '192.168.1.104',
    protocol: 'HTTP',
    port: 80,
    status: 'online',
    rtt: 28,
    remark: '前端网关服务器',
    refreshInterval: 2,
  },
  {
    key: '5',
    name: 'API服务',
    address: '192.168.1.105',
    protocol: 'HTTPS',
    port: 443,
    status: 'online',
    rtt: 65,
    remark: '后端API服务',
    refreshInterval: 2,
  },
  {
    key: '6',
    name: '备份服务器',
    address: '192.168.1.101',
    protocol: 'TCP',
    port: 22,
    status: 'online',
    rtt: 52,
    remark: '生产环境备份服务器',
    refreshInterval: 2,
  },
  {
    key: '7',
    name: '消息队列',
    address: '192.168.1.107',
    protocol: 'TCP',
    port: 5672,
    status: 'online',
    rtt: 22,
    remark: 'RabbitMQ消息队列',
    refreshInterval: 2,
  },
  {
    key: '8',
    name: '日志服务器',
    address: '192.168.1.106',
    protocol: 'TCP',
    port: 9200,
    status: 'online',
    rtt: 35,
    remark: 'Elasticsearch日志',
    refreshInterval: 2,
  },
  {
    key: '9',
    name: 'Google',
    address: 'www.google.com',
    protocol: 'HTTPS',
    port: 443,
    status: 'offline',
    rtt: 0,
    remark: '谷歌（国内不可访问）',
    refreshInterval: 2,
  },
];

// 初始化目标数据（添加历史数据字段）
export function initTargets(): MonitorTarget[] {
  return defaultTargets.map((t) => ({
    ...t,
    rttHistory: [],
    timeLabels: [],
  }));
}
