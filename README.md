# 网络监控控制台

基于 Vue 3 + Ant Design Vue + Nitro + MySQL 的网络监控系统。

---

## 目录结构

```
apps/
├── frontend/                      # 前端应用
│   ├── src/
│   │   ├── views/
│   │   │   └── monitor/           # 监控模块
│   │   │       ├── dashboard/     # 监控面板 - 实时监控
│   │   │       ├── query/         # 历史查询 - 数据查询
│   │   │       ├── notification/  # 通知配置 - 告警设置
│   │   │       └── data/          # 共享数据 - 状态管理
│   │   ├── api/                   # API接口定义
│   │   ├── router/                # 路由配置
│   │   └── locales/               # 国际化
│   ├── public/                    # 静态资源
│   ├── vite.config.mts            # Vite配置
│   └── package.json
│
├── backend/                       # 后端服务
│   ├── api/                       # API接口
│   │   ├── monitor/               # 监控相关
│   │   │   └── ping.post.ts       # Ping探测
│   │   ├── alert/                 # 告警相关
│   │   │   ├── config.get.ts      # 获取配置
│   │   │   ├── config.post.ts     # 保存配置
│   │   │   ├── logs.get.ts        # 告警日志
│   │   │   └── trigger.post.ts    # 触发告警
│   │   └── sms/                   # 短信相关
│   │       ├── test.post.ts       # 测试短信
│   │       ├── send.post.ts       # 发送短信
│   │       └── logs.get.ts        # 短信日志
│   ├── data/                      # JSON数据存储
│   ├── utils/                     # 工具函数
│   │   └── sms_config.py          # 短信发送模块
│   ├── middleware/                # 中间件
│   ├── nitro.config.ts            # Nitro配置
│   └── package.json
│
└── database/                      # 数据库
    ├── config/                    # 连接配置
    │   └── mysql.ts               # MySQL配置
    ├── migrations/                # 迁移脚本
    │   └── 001_init.sql           # 初始化脚本
    └── seeds/                     # 初始数据
        └── init_data.sql          # 测试数据
```

---

## 一、前端 (Frontend)

### 技术栈
- Vue 3 + TypeScript
- Ant Design Vue
- ECharts (图表)
- Vite (构建工具)
- Tailwind CSS (样式)
- Pinia (状态管理)

### 功能模块

#### 1. 监控面板 (Dashboard)
- 实时监控多个网络目标
- 支持 ICMP/TCP/HTTP/HTTPS 协议
- RTT 实时图表展示（ECharts）
- 在线/离线状态显示
- 添加/编辑/删除监控目标
- 自定义刷新间隔和最大延迟

#### 2. 历史查询 (Query)
- 查询历史监控数据
- 支持时间范围筛选
- 数据分层存储策略
- 图表拖拽滚动

#### 3. 通知配置 (Notification)
- 告警规则配置
- 连续失败次数触发
- 告警冷却时间
- 恢复通知
- 短信发送测试
- 告警日志查询

### 启动命令
```bash
# 开发模式 (端口 5666)
pnpm dev:frontend

# 构建生产版本
pnpm build:frontend
```

### 代理配置
前端开发服务器代理配置在 `apps/frontend/vite.config.mts`:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:5320',
    changeOrigin: true,
  },
}
```

---

## 二、后端 (Backend)

### 技术栈
- Nitro (Node.js 服务端框架)
- TypeScript
- H3 (HTTP框架)

### API 接口

#### 监控接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/monitor/ping | Ping探测 |

请求参数:
```json
{
  "address": "192.168.1.1",
  "protocol": "ICMP",
  "port": null
}
```

响应:
```json
{
  "success": true,
  "status": "online",
  "rtt": 20
}
```

#### 告警接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/alert/config | 获取告警配置 |
| POST | /api/alert/config | 保存告警配置 |
| GET | /api/alert/logs | 获取告警日志 |
| POST | /api/alert/trigger | 触发告警 |

#### 短信接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/sms/test | 发送测试短信 |
| POST | /api/sms/send | 发送短信 |
| GET | /api/sms/logs | 获取短信日志 |

### 启动命令
```bash
# 开发模式 (端口 5320)
pnpm dev:backend

# 构建生产版本
pnpm -F @vben/backend build
```

### 短信配置
短信使用移动云MAS平台，配置在 `apps/backend/utils/sms_config.py`。

---

## 三、数据库 (Database)

### 技术栈
- MySQL 8.0

### 环境变量配置
在项目根目录创建 `.env` 文件:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=monitor_console
```

### 数据表设计

#### monitor_targets - 监控目标表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| name | VARCHAR(100) | 目标名称 |
| address | VARCHAR(255) | IP地址或域名 |
| protocol | VARCHAR(10) | 协议(ICMP/TCP/HTTP/HTTPS) |
| port | INT | 端口号 |
| status | VARCHAR(20) | 状态(online/offline) |
| rtt | INT | 当前RTT |
| remark | TEXT | 备注 |
| refresh_interval | INT | 刷新间隔(秒) |
| max_rtt | INT | 最大延迟(ms) |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

#### monitor_logs - 监控日志表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| target_id | INT | 目标ID |
| rtt | INT | 响应时间(ms) |
| status | VARCHAR(20) | 状态 |
| created_at | DATETIME | 记录时间 |

#### alert_configs - 告警配置表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| target_id | INT | 目标ID |
| consecutive_failures | INT | 连续失败次数 |
| cooldown_minutes | INT | 冷却时间(分钟) |
| notify_recovery | BOOLEAN | 恢复时通知 |
| enabled | BOOLEAN | 是否启用 |

#### alert_logs - 告警日志表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| target_id | INT | 目标ID |
| type | VARCHAR(20) | 类型(offline/recovery) |
| message | TEXT | 告警内容 |
| created_at | DATETIME | 告警时间 |

#### sms_logs - 短信日志表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| phone | VARCHAR(20) | 手机号 |
| content | TEXT | 短信内容 |
| status | VARCHAR(20) | 发送状态 |
| created_at | DATETIME | 发送时间 |

### 初始化数据库
```bash
# 创建数据库和表
mysql -u root -p < apps/database/migrations/001_init.sql

# 导入测试数据
mysql -u root -p < apps/database/seeds/init_data.sql
```

---

## 四、前后端数据库对接说明

### 数据流向
```
前端 (Vue) <--HTTP--> 后端 (Nitro) <--MySQL--> 数据库
```

### 对接步骤

#### 1. 后端连接数据库
在 `apps/backend/utils/db.ts` 中添加数据库连接:
```typescript
import mysql from 'mysql2/promise';
import { dbConfig } from '../../database/config/mysql';

export const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: 10,
});
```

#### 2. API 调用数据库
在 API 接口中使用数据库:
```typescript
// apps/backend/api/monitor/targets.get.ts
import { pool } from '../../utils/db';

export default defineEventHandler(async () => {
  const [rows] = await pool.query('SELECT * FROM monitor_targets');
  return { success: true, data: rows };
});
```

#### 3. 前端调用 API
```typescript
// apps/frontend/src/api/monitor.ts
export async function getTargets() {
  const res = await fetch('/api/monitor/targets');
  return res.json();
}
```

### 当前状态
- ✅ 前端已完成
- ✅ 后端API已完成（使用JSON文件存储）
- ⏳ 数据库对接待完成（需要安装mysql2依赖）

### 切换到MySQL存储
1. 安装依赖: `pnpm -F @vben/backend add mysql2`
2. 创建数据库连接工具
3. 修改API接口使用数据库查询
4. 运行数据库迁移脚本

---

## 五、快速开始

### 环境要求
- Node.js >= 20
- pnpm >= 10
- Python 3 (短信功能)
- MySQL 8.0 (可选，当前使用JSON存储)

### 安装依赖
```bash
pnpm install
```

### 启动开发服务器
```bash
# 同时启动前后端
pnpm dev

# 或分别启动
pnpm dev:frontend  # 前端 http://localhost:5666
pnpm dev:backend   # 后端 http://localhost:5320
```

### 访问地址
- 前端: http://localhost:5666
- 后端API: http://localhost:5320/api
- 监控面板: http://localhost:5666/#/monitor/dashboard
- 历史查询: http://localhost:5666/#/monitor/query
- 通知配置: http://localhost:5666/#/monitor/notification
