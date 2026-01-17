-- ============================================
-- 监控控制台初始化测试数据
-- ============================================

USE monitor_console;

-- 清空现有数据（可选）
-- TRUNCATE TABLE monitor_logs;
-- TRUNCATE TABLE alert_logs;
-- TRUNCATE TABLE sms_logs;
-- TRUNCATE TABLE alert_configs;
-- TRUNCATE TABLE monitor_targets;

-- 插入示例监控目标
INSERT INTO monitor_targets (`key`, name, address, protocol, port, status, rtt, remark, refresh_interval, max_rtt) VALUES
('demo_1', '主服务器', '192.168.1.100', 'ICMP', NULL, 'online', 45, '生产环境主服务器', 2, 100),
('demo_2', '数据库服务器', '192.168.1.102', 'TCP', 3306, 'online', 38, 'MySQL数据库', 2, 100),
('demo_3', 'Redis缓存', '192.168.1.103', 'TCP', 6379, 'online', 12, 'Redis缓存服务器', 2, 100),
('demo_4', 'Nginx网关', '192.168.1.104', 'HTTP', 80, 'online', 28, '前端网关服务器', 2, 100),
('demo_5', 'API服务', '192.168.1.105', 'HTTPS', 443, 'online', 65, '后端API服务', 2, 100),
('demo_6', '百度', 'www.baidu.com', 'HTTPS', 443, 'online', 20, '百度搜索', 2, 100)
ON DUPLICATE KEY UPDATE name = VALUES(name);
