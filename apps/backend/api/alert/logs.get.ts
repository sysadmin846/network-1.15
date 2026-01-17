import { getPool } from '../../utils/db';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const page = Number(query.page) || 1;
  const pageSize = Number(query.pageSize) || 20;
  const type = query.type as string; // 'alert' | 'recovery' | 'all'
  const targetKey = query.targetKey as string;
  const startDate = query.startDate as string;
  const endDate = query.endDate as string;

  try {
    const pool = getPool();
    
    // 构建查询条件
    let whereClauses: string[] = [];
    let params: any[] = [];
    
    if (type && type !== 'all') {
      whereClauses.push('type = ?');
      params.push(type);
    }
    
    if (targetKey) {
      whereClauses.push('target_key = ?');
      params.push(targetKey);
    }
    
    if (startDate) {
      whereClauses.push('DATE(created_at) >= ?');
      params.push(startDate);
    }
    
    if (endDate) {
      whereClauses.push('DATE(created_at) <= ?');
      params.push(endDate);
    }
    
    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    // 查询总数
    const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM alert_logs ${whereStr}`, params) as any;
    const total = countResult[0].total;
    
    // 查询数据
    const offset = (page - 1) * pageSize;
    const [rows] = await pool.query(`
      SELECT id, type, target_key, target_name, target_address, offline_time, recovery_time, content, sms_status, sms_error, created_at
      FROM alert_logs
      ${whereStr}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]) as any;
    
    // 格式化数据
    const list = rows.map((row: any) => ({
      id: row.id,
      time: new Date(row.created_at).toLocaleString('zh-CN'),
      type: row.type,
      targetKey: row.target_key,
      targetName: row.target_name,
      targetAddress: row.target_address,
      offlineTime: row.offline_time,
      recoveryTime: row.recovery_time,
      content: row.content,
      smsStatus: row.sms_status,
      smsError: row.sms_error,
    }));

    return {
      success: true,
      data: {
        list,
        total,
        page,
        pageSize,
      },
    };
  } catch (error: any) {
    console.error('获取告警日志失败:', error);
    return {
      success: false,
      error: error.message || '获取日志失败',
      data: { list: [], total: 0, page, pageSize },
    };
  }
});
