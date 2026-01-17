import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendRoot = join(__dirname, '../..');
const logFile = join(backendRoot, 'data/sms_log.json');

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const page = Number(query.page) || 1;
  const pageSize = Number(query.pageSize) || 20;
  const type = query.type as string; // 'test' | 'alert' | 'recovery' | 'all'

  try {
    let logs: any[] = [];
    
    if (existsSync(logFile)) {
      logs = JSON.parse(readFileSync(logFile, 'utf-8'));
    }

    // 过滤
    if (type && type !== 'all') {
      if (type === 'test') {
        logs = logs.filter(log => log.isTest);
      } else {
        logs = logs.filter(log => !log.isTest && log.type === type);
      }
    }

    // 分页
    const total = logs.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const data = logs.slice(start, end);

    return {
      success: true,
      data: {
        list: data,
        total,
        page,
        pageSize,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || '获取日志失败',
      data: {
        list: [],
        total: 0,
        page,
        pageSize,
      },
    };
  }
});
