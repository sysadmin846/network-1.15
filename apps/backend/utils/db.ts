import mysql from 'mysql2/promise';

// 数据库配置
const dbConfig = {
  host: '192.168.160.57',
  port: 3308,
  user: 'root',
  password: '1325343256',
  database: 'monitor_console',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// 连接池（延迟初始化）
let pool: mysql.Pool | null = null;

// 获取连接池
export function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

// 测试连接
export async function testConnection() {
  try {
    const p = getPool();
    const connection = await p.getConnection();
    console.log('数据库连接成功');
    connection.release();
    return true;
  } catch (error: any) {
    // 如果是数据库不存在的错误，尝试创建
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('数据库不存在，尝试创建...');
      return await createDatabase();
    }
    console.error('数据库连接失败:', error);
    return false;
  }
}

// 创建数据库
async function createDatabase() {
  try {
    const tempPool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
    });
    
    await tempPool.query(`CREATE DATABASE IF NOT EXISTS monitor_console DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log('数据库创建成功');
    await tempPool.end();
    
    // 重新创建连接池
    pool = mysql.createPool(dbConfig);
    return true;
  } catch (error) {
    console.error('创建数据库失败:', error);
    return false;
  }
}

// 初始化数据库表
export async function initDatabase() {
  try {
    const p = getPool();
    
    // 创建监控目标表
    await p.query(`
      CREATE TABLE IF NOT EXISTS monitor_targets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        \`key\` VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        address VARCHAR(255) NOT NULL,
        protocol VARCHAR(10) NOT NULL DEFAULT 'ICMP',
        port INT NULL,
        status VARCHAR(20) DEFAULT 'online',
        rtt INT DEFAULT 0,
        remark TEXT,
        refresh_interval INT DEFAULT 2,
        max_rtt INT DEFAULT 100,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_key (\`key\`),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // 创建告警日志表
    await p.query(`
      CREATE TABLE IF NOT EXISTS alert_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(20) NOT NULL COMMENT '类型(alert/recovery)',
        target_key VARCHAR(50) NOT NULL COMMENT '监控目标key',
        target_name VARCHAR(100) NOT NULL COMMENT '监控目标名称',
        target_address VARCHAR(255) NOT NULL COMMENT '监控目标地址',
        offline_time VARCHAR(50) COMMENT '断线时间',
        recovery_time VARCHAR(50) COMMENT '恢复时间',
        content TEXT COMMENT '告警内容',
        sms_status VARCHAR(20) DEFAULT 'pending' COMMENT '短信状态(pending/sent/failed/skipped)',
        sms_error TEXT COMMENT '短信错误信息',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
        INDEX idx_type (type),
        INDEX idx_target_key (target_key),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警日志表'
    `);
    
    // 创建告警状态表（持久化告警状态，防止页面重载后丢失）
    await p.query(`
      CREATE TABLE IF NOT EXISTS alert_states (
        id INT AUTO_INCREMENT PRIMARY KEY,
        target_key VARCHAR(50) NOT NULL UNIQUE COMMENT '监控目标key',
        failure_count INT DEFAULT 0 COMMENT '连续失败次数',
        is_alerting TINYINT DEFAULT 0 COMMENT '是否已发送告警',
        offline_start_time VARCHAR(50) COMMENT '首次离线时间',
        last_status VARCHAR(20) COMMENT '上次状态',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        INDEX idx_target_key (target_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警状态表'
    `);
    
    console.log('数据库表初始化成功');
    return true;
  } catch (error) {
    console.error('数据库表初始化失败:', error);
    return false;
  }
}

// 获取目标的日志表名（每个目标一个表）
// 表名格式: logs_名称_key
export function getLogTableName(targetKey: string, targetName?: string): string {
  const safeKey = targetKey.replace(/[^a-zA-Z0-9]/g, '_');
  if (targetName) {
    // 清理名称中的特殊字符，保留中文、字母、数字
    const safeName = targetName.trim().replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    return `logs_${safeName}_${safeKey}`;
  }
  return `logs_${safeKey}`;
}

// 根据 targetKey 查找对应的日志表（兼容旧表名和新表名）
export async function findLogTable(targetKey: string): Promise<string | null> {
  try {
    const p = getPool();
    const safeKey = targetKey.replace(/[^a-zA-Z0-9]/g, '_');
    
    // 查找匹配的表（可能是 logs_key 或 logs_name_key 格式）
    const [tables] = await p.query(`SHOW TABLES LIKE 'logs_%${safeKey}'`) as any[];
    
    if (tables.length > 0) {
      return Object.values(tables[0])[0] as string;
    }
    return null;
  } catch (error) {
    console.error('查找日志表失败:', error);
    return null;
  }
}

// 为目标创建独立的日志表
export async function createLogTable(targetKey: string, targetName: string) {
  try {
    const p = getPool();
    const tableName = getLogTableName(targetKey, targetName);
    
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        rtt INT DEFAULT 0 COMMENT '响应时间(ms)',
        status VARCHAR(20) NOT NULL COMMENT '状态(online/offline)',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
        INDEX idx_created_at (created_at),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='${targetName}的监控日志'
    `);
    
    console.log(`创建日志表: ${tableName} (${targetName})`);
    return tableName;
  } catch (error) {
    console.error(`创建日志表失败 ${targetKey}:`, error);
    return null;
  }
}

// 删除目标的日志表
export async function dropLogTable(targetKey: string, targetName?: string) {
  try {
    const p = getPool();
    
    // 先尝试查找现有表
    let tableName = await findLogTable(targetKey);
    
    // 如果没找到，尝试用新格式
    if (!tableName && targetName) {
      tableName = getLogTableName(targetKey, targetName);
    }
    
    // 如果还没找到，用旧格式
    if (!tableName) {
      tableName = getLogTableName(targetKey);
    }
    
    await p.query(`DROP TABLE IF EXISTS \`${tableName}\``);
    console.log(`删除日志表: ${tableName}`);
    return true;
  } catch (error) {
    console.error(`删除日志表失败 ${targetKey}:`, error);
    return false;
  }
}

// 重命名日志表（从旧格式迁移到新格式）
export async function renameLogTable(targetKey: string, targetName: string) {
  try {
    const p = getPool();
    const oldTableName = `logs_${targetKey.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const newTableName = getLogTableName(targetKey, targetName);
    
    // 检查旧表是否存在
    const [tables] = await p.query(`SHOW TABLES LIKE '${oldTableName}'`) as any[];
    
    if (tables.length > 0 && oldTableName !== newTableName) {
      await p.query(`RENAME TABLE \`${oldTableName}\` TO \`${newTableName}\``);
      console.log(`重命名日志表: ${oldTableName} -> ${newTableName}`);
      return newTableName;
    }
    
    return oldTableName;
  } catch (error) {
    console.error(`重命名日志表失败 ${targetKey}:`, error);
    return null;
  }
}

// 导出 pool 的 getter
export { pool };

// ==================== 告警状态管理 ====================

// 获取告警状态
export async function getAlertState(targetKey: string) {
  try {
    const p = getPool();
    const [rows] = await p.query(`
      SELECT * FROM alert_states WHERE target_key = ?
    `, [targetKey]) as any[];
    
    if (rows.length > 0) {
      return {
        failureCount: rows[0].failure_count,
        isAlerting: rows[0].is_alerting === 1,
        offlineStartTime: rows[0].offline_start_time,
        lastStatus: rows[0].last_status,
      };
    }
    
    return null;
  } catch (error) {
    console.error('获取告警状态失败:', error);
    return null;
  }
}

// 更新告警状态
export async function updateAlertState(targetKey: string, state: {
  failureCount?: number;
  isAlerting?: boolean;
  offlineStartTime?: string;
  lastStatus?: string;
}) {
  try {
    const p = getPool();
    
    // 先检查是否存在
    const [rows] = await p.query(`
      SELECT id FROM alert_states WHERE target_key = ?
    `, [targetKey]) as any[];
    
    if (rows.length > 0) {
      // 更新现有记录
      const updates: string[] = [];
      const values: any[] = [];
      
      if (state.failureCount !== undefined) {
        updates.push('failure_count = ?');
        values.push(state.failureCount);
      }
      if (state.isAlerting !== undefined) {
        updates.push('is_alerting = ?');
        values.push(state.isAlerting ? 1 : 0);
      }
      if (state.offlineStartTime !== undefined) {
        updates.push('offline_start_time = ?');
        values.push(state.offlineStartTime);
      }
      if (state.lastStatus !== undefined) {
        updates.push('last_status = ?');
        values.push(state.lastStatus);
      }
      
      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(targetKey);
        
        await p.query(`
          UPDATE alert_states SET ${updates.join(', ')} WHERE target_key = ?
        `, values);
      }
    } else {
      // 插入新记录
      await p.query(`
        INSERT INTO alert_states (target_key, failure_count, is_alerting, offline_start_time, last_status)
        VALUES (?, ?, ?, ?, ?)
      `, [
        targetKey,
        state.failureCount || 0,
        state.isAlerting ? 1 : 0,
        state.offlineStartTime || null,
        state.lastStatus || null,
      ]);
    }
  } catch (error) {
    console.error('更新告警状态失败:', error);
  }
}

// 重置告警状态
export async function resetAlertState(targetKey: string) {
  try {
    const p = getPool();
    await p.query(`
      DELETE FROM alert_states WHERE target_key = ?
    `, [targetKey]);
  } catch (error) {
    console.error('重置告警状态失败:', error);
  }
}
