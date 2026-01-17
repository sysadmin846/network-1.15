import { initDatabase, testConnection } from '../../utils/db';

export default defineEventHandler(async () => {
  try {
    // 测试连接
    const connected = await testConnection();
    if (!connected) {
      return {
        code: -1,
        data: null,
        message: '数据库连接失败',
      };
    }
    
    // 初始化表结构
    const initialized = await initDatabase();
    if (!initialized) {
      return {
        code: -1,
        data: null,
        message: '数据库表初始化失败',
      };
    }
    
    return {
      code: 0,
      data: null,
      message: '数据库初始化成功',
    };
  } catch (error: any) {
    console.error('数据库初始化失败:', error);
    return {
      code: -1,
      data: null,
      message: error.message || '数据库初始化失败',
    };
  }
});
