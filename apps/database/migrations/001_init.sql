-- ============================================
-- 监控控制台数据库初始化脚本
-- 数据库: monitor_console
-- 版本: 1.0.0
-- ============================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS monitor_console 
  DEFAULT CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE monitor_console;

-- ============================================
-- 1. 监控目标表 (monitor_targets)
-- 存储所有监控对象的配置信息
-- ============================================
CREATE TABLE IF NOT EXISTS monitor_targets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(50) NOT NULL UNIQUE COMMENT '唯一标识(前端生成)',
  name VARCHAR(100) NOT NULL COMMENT '目标名称',
  address VARCHAR(255) NOT NULL COMMENT 'IP地址或域名',
  protocol VARCHAR(10) NOT NULL DEFAULT 'ICMP' COMMENT '协议(ICMP/TCP/UDP/HTTP/HTTPS)',
  port INT NULL COMMENT '端口号',
  status VARCHAR(20) DEFAULT 'online' COMMENT '状态(online/offline)',
  rtt INT DEFAULT 0 COMMENT '当前RTT(ms)',
  remark TEXT COMMENT '备注',
  refresh_interval INT DEFAULT 2 COMMENT '刷新间隔(秒)',
  max_rtt INT DEFAULT 100 COMMENT '最大延迟阈值(ms)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_key (`key`),
  INDEX idx_status (status),
  INDEX idx_address (address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='监控目标表';

-- ============================================
-- 2. 监控日志表 (monitor_logs)
-- 存储每次ping探测的结果记录
-- ============================================
CREATE TABLE IF NOT EXISTS monitor_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  target_key VARCHAR(50) NOT NULL COMMENT '目标key',
  target_name VARCHAR(100) DEFAULT '' COMMENT '目标名称（冗余存储方便查询）',
  rtt INT DEFAULT 0 COMMENT '响应时间(ms)',
  status VARCHAR(20) NOT NULL COMMENT '状态(online/offline)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  INDEX idx_target_key (target_key),
  INDEX idx_target_name (target_name),
  INDEX idx_created_at (created_at),
  INDEX idx_target_time (target_key, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='监控日志表';

-- ============================================
-- 3. 告警配置表 (alert_configs)
-- 存储告警规则配置
-- ============================================
CREATE TABLE IF NOT EXISTS alert_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_key VARCHAR(50) NOT NULL COMMENT '目标key',
  consecutive_failures INT DEFAULT 3 COMMENT '连续失败次数触发告警',
  cooldown_minutes INT DEFAULT 5 COMMENT '告警冷却时间(分钟)',
  notify_recovery BOOLEAN DEFAULT TRUE COMMENT '恢复时是否通知',
  enabled BOOLEAN DEFAULT FALSE COMMENT '是否启用告警',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_target_key (target_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警配置表';

-- ============================================
-- 4. 告警日志表 (alert_logs)
-- 存储告警触发记录
-- ============================================
CREATE TABLE IF NOT EXISTS alert_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  target_key VARCHAR(50) NOT NULL COMMENT '目标key',
  type VARCHAR(20) NOT NULL COMMENT '类型(offline/recovery)',
  message TEXT COMMENT '告警内容',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '告警时间',
  INDEX idx_target_key (target_key),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警日志表';

-- ============================================
-- 5. 短信日志表 (sms_logs)
-- 存储短信发送记录
-- ============================================
CREATE TABLE IF NOT EXISTS sms_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL COMMENT '手机号',
  content TEXT NOT NULL COMMENT '短信内容',
  status VARCHAR(20) DEFAULT 'pending' COMMENT '发送状态(pending/success/failed)',
  error_msg TEXT COMMENT '错误信息',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  INDEX idx_phone (phone),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='短信日志表';
