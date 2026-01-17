/**
 * MySQL 数据库连接配置
 * 
 * 当前连接信息:
 * - 主机: 192.168.160.57
 * - 端口: 3308
 * - 用户: root
 * - 数据库: monitor_console
 */

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  waitForConnections: boolean;
  connectionLimit: number;
  queueLimit: number;
}

// 数据库配置（可通过环境变量覆盖）
export const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || '192.168.160.57',
  port: parseInt(process.env.DB_PORT || '3308', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1325343256',
  database: process.env.DB_NAME || 'monitor_console',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// 连接字符串
export const connectionString = `mysql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
