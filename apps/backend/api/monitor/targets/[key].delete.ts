import { getPool, dropLogTable, findLogTable } from '../../../utils/db';

export default defineEventHandler(async (event) => {
  try {
    const key = getRouterParam(event, 'key');
    
    if (!key) {
      return {
        code: -1,
        data: null,
        message: '缺少目标key',
      };
    }
    
    const pool = getPool();
    
    // 先获取目标名称
    const [targets] = await pool.query('SELECT name FROM monitor_targets WHERE `key` = ?', [key]) as any;
    const targetName = targets.length > 0 ? targets[0].name : undefined;
    
    // 删除对应的日志表（兼容新旧格式）
    await dropLogTable(key, targetName);
    
    // 删除监控目标
    await pool.query('DELETE FROM monitor_targets WHERE `key` = ?', [key]);
    
    return {
      code: 0,
      data: null,
      message: '删除成功',
    };
  } catch (error: any) {
    console.error('删除监控目标失败:', error);
    return {
      code: -1,
      data: null,
      message: error.message || '删除监控目标失败',
    };
  }
});
