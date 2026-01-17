import { getPool, findLogTable } from '../../utils/db';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { targetKey, startTime, endTime, limit } = query;
    
    if (!targetKey) {
      return {
        code: -1,
        data: null,
        message: '缺少目标key',
      };
    }
    
    const pool = getPool();
    
    // 查找对应的日志表（兼容新旧格式）
    const tableName = await findLogTable(targetKey as string);
    
    if (!tableName) {
      return {
        code: 0,
        data: [],
        message: 'ok',
      };
    }
    
    let sql = `
      SELECT rtt, status, created_at as createdAt
      FROM \`${tableName}\`
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (startTime) {
      sql += ' AND created_at >= ?';
      params.push(startTime);
    }
    
    if (endTime) {
      sql += ' AND created_at <= ?';
      params.push(endTime);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit as string, 10));
    }
    
    const [rows] = await pool.query(sql, params) as any[];
    
    // 反转顺序，使其按时间升序排列（最早的在前，最新的在后）
    const sortedRows = (rows as any[]).reverse();
    
    return {
      code: 0,
      data: sortedRows,
      message: 'ok',
    };
  } catch (error: any) {
    console.error('获取监控日志失败:', error);
    return {
      code: -1,
      data: null,
      message: error.message || '获取监控日志失败',
    };
  }
});
