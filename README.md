# 网络监控系统

实时监控网络设备状态的功能模块，支持多协议探测和历史数据可视化。

## 功能特性

### 监控面板 (Dashboard)
- 实时显示所有监控目标的状态（在线/离线）
- RTT（往返时延）实时图表展示
- 支持搜索过滤监控目标
- 支持添加、编辑、删除监控目标
- 离线设备显示"未响应"并以红色标识
- 深色/浅色主题自适应

### 数据查询 (Query)
- 按时间范围查询历史监控数据
- 支持按状态筛选（全部/在线/离线）
- 数据表格展示，支持分页

## 支持的协议

| 协议 | 说明 |
|------|------|
| ICMP | Ping 探测 |
| TCP | TCP 端口探测 |
| UDP | UDP 端口探测 |
| HTTP | HTTP 服务探测 |
| HTTPS | HTTPS 服务探测 |

## 项目结构

```
apps/web-antd/src/views/monitor/
├── dashboard/          # 监控面板
│   └── index.vue
├── query/              # 数据查询
│   └── index.vue
└── data/               # 共享数据
    └── targets.ts      # 监控目标配置
```

## 数据模型

```typescript
interface MonitorTarget {
  key: string;          // 唯一标识
  name: string;         // 名称
  address: string;      // IP地址或域名
  protocol: string;     // 协议类型
  port: number | null;  // 端口号
  status: string;       // 状态: online/offline
  rtt: number;          // 当前RTT (ms)
  remark: string;       // 备注
  rttHistory: number[]; // RTT历史数据
  timeLabels: string[]; // 时间标签
}
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev:antd

# 访问
http://localhost:5666/
```

## 使用说明

### 添加监控目标
1. 点击"添加"按钮
2. 填写名称、地址、协议等信息
3. 点击确定保存

### 查询历史数据
1. 进入"数据查询"页面
2. 选择时间范围
3. 可按状态筛选结果

## 技术栈

- Vue 3 + TypeScript
- Ant Design Vue
- ECharts (图表)
- Vben Admin 框架
- Vite
- pnpm
