import { getAlertState, updateAlertState, resetAlertState } from '../../utils/db';

export default defineEventHandler(async (event) => {
  const method = event.node.req.method;
  
  if (method === 'GET') {
    // 获取告警状态
    const query = getQuery(event);
    const targetKey = query.targetKey as string;
    
    if (!targetKey) {
      return {
        success: false,
        error: '缺少 targetKey 参数',
      };
    }
    
    try {
      const state = await getAlertState(targetKey);
      return {
        success: true,
        data: state || {
          failureCount: 0,
          isAlerting: false,
          offlineStartTime: '',
          lastStatus: 'online',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '获取告警状态失败',
      };
    }
  } else if (method === 'POST') {
    // 更新告警状态
    try {
      const body = await readBody(event);
      const { targetKey, failureCount, isAlerting, offlineStartTime, lastStatus } = body;
      
      if (!targetKey) {
        return {
          success: false,
          error: '缺少 targetKey 参数',
        };
      }
      
      await updateAlertState(targetKey, {
        failureCount,
        isAlerting,
        offlineStartTime,
        lastStatus,
      });
      
      return {
        success: true,
        message: '告警状态已更新',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '更新告警状态失败',
      };
    }
  } else if (method === 'DELETE') {
    // 删除告警状态
    const query = getQuery(event);
    const targetKey = query.targetKey as string;
    
    if (!targetKey) {
      return {
        success: false,
        error: '缺少 targetKey 参数',
      };
    }
    
    try {
      await resetAlertState(targetKey);
      return {
        success: true,
        message: '告警状态已删除',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '删除告警状态失败',
      };
    }
  }
  
  return {
    success: false,
    error: '不支持的请求方法',
  };
});
