import { getPool } from '../../utils/db';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { key, name, address, protocol, port, remark, refreshInterval, maxRtt } = body;
    
    if (!key || !name || !address || !protocol) {
      return {
        code: -1,
        data: null,
        message: '缺少必要参数',
      };
    }
    
    const pool = getPool();
    await pool.query(`
      INSERT INTO monitor_targets (\`key\`, name, address, protocol, port, remark, refresh_interval, max_rtt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        address = VALUES(address),
        protocol = VALUES(protocol),
        port = VALUES(port),
        remark = VALUES(remark),
        refresh_interval = VALUES(refresh_interval),
        max_rtt = VALUES(max_rtt)
    `, [key, name, address, protocol, port || null, remark || '', refreshInterval || 2, maxRtt || 100]);
    
    return {
      code: 0,
      data: { key },
      message: '保存成功',
    };
  } catch (error: any) {
    console.error('保存监控目标失败:', error);
    return {
      code: -1,
      data: null,
      message: error.message || '保存监控目标失败',
    };
  }
});
