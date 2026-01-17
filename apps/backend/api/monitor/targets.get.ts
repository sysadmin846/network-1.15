import { getPool } from '../../utils/db';

export default defineEventHandler(async () => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT \`key\`, name, address, protocol, port, status, rtt, remark, 
             refresh_interval as refreshInterval, max_rtt as maxRtt,
             created_at as createdAt, updated_at as updatedAt
      FROM monitor_targets
      ORDER BY created_at ASC
    `);
    
    return {
      code: 0,
      data: rows,
      message: 'ok',
    };
  } catch (error: any) {
    console.error('获取监控目标失败:', error);
    return {
      code: -1,
      data: null,
      message: error.message || '获取监控目标失败',
    };
  }
});
