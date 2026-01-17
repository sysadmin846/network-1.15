import { getPool, getLogTableName, createLogTable, findLogTable } from '../../utils/db';

// 记录每个目标最后保存的时间戳，防止重复保存
const lastSaveTime = new Map<string, number>();

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { targetKey, rtt, status, targetName, refreshInterval } = body;
    
    if (!targetKey) {
      return {
        code: -1,
        data: null,
        message: '缺少目标key',
      };
    }
    
    const interval = refreshInterval || 2;
    
    // 计算对齐到刷新间隔的时间
    const now = new Date();
    const seconds = now.getSeconds();
    const alignedSeconds = Math.floor(seconds / interval) * interval;
    now.setSeconds(alignedSeconds, 0); // 设置秒和毫秒
    const alignedTimestamp = now.getTime();
    
    // 防止同一个对齐时间点重复保存
    const lastTime = lastSaveTime.get(targetKey) || 0;
    if (alignedTimestamp === lastTime) {
      return {
        code: 0,
        data: null,
        message: '跳过重复记录',
      };
    }
    lastSaveTime.set(targetKey, alignedTimestamp);
    
    const pool = getPool();
    
    // 先查找现有表，如果不存在则创建新表（带名称）
    let tableName = await findLogTable(targetKey);
    if (!tableName) {
      tableName = await createLogTable(targetKey, targetName || '');
    }
    
    if (!tableName) {
      return {
        code: -1,
        data: null,
        message: '无法创建或找到日志表',
      };
    }
    
    // 格式化对齐后的时间
    const alignedTimeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    // 插入监控日志到独立表（使用对齐后的时间）
    await pool.query(`
      INSERT INTO \`${tableName}\` (rtt, status, created_at)
      VALUES (?, ?, ?)
    `, [rtt || 0, status || 'offline', alignedTimeStr]);
    
    // 更新目标的当前状态
    await pool.query(`
      UPDATE monitor_targets 
      SET status = ?, rtt = ?
      WHERE \`key\` = ?
    `, [status || 'offline', rtt || 0, targetKey]);
    
    return {
      code: 0,
      data: null,
      message: '记录成功',
    };
  } catch (error: any) {
    console.error('记录监控日志失败:', error);
    return {
      code: -1,
      data: null,
      message: error.message || '记录监控日志失败',
    };
  }
});
