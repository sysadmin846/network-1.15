import { getPool, findLogTable } from '../../utils/db';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { targetKey } = query;
    
    const pool = getPool();
    
    if (targetKey) {
      // 清空指定目标的日志表（兼容新旧格式）
      const tableName = await findLogTable(targetKey as string);
      if (tableName) {
        await pool.query(`TRUNCATE TABLE \`${tableName}\``);
        console.log(`清空日志表: ${tableName}`);
      }
    } else {
      // 清空所有日志表（查找所有 logs_ 开头的表）
      const [tables] = await pool.query(`SHOW TABLES LIKE 'logs_%'`) as any;
      for (const row of tables) {
        const tableName = Object.values(row)[0] as string;
        await pool.query(`TRUNCATE TABLE \`${tableName}\``);
        console.log(`清空日志表: ${tableName}`);
      }
    }
    
    return {
      code: 0,
      data: null,
      message: '日志已清空',
    };
  } catch (error: any) {
    console.error('清空监控日志失败:', error);
    return {
      code: -1,
      data: null,
      message: error.message || '清空监控日志失败',
    };
  }
});
