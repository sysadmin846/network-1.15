# 网络监控控制台

基于 Vue 3 + Nitro + MySQL 的网络监控系统。

## 项目结构

```
monitor-console/
├── apps/                    # 应用目录
│   ├── frontend/            # 前端 (Vue 3 + Ant Design Vue)
│   ├── backend/             # 后端 (Nitro)
│   ├── database/            # 数据库 (MySQL)
│   └── README.md            # 详细说明文档
├── packages/                # 共享包
└── internal/                # 内部工具
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动前端 (端口 5666)
pnpm dev:frontend

# 启动后端 (端口 5320)
pnpm dev:backend
```

## 详细文档

查看 [apps/README.md](./apps/README.md) 获取完整的前后端数据库对接说明。
