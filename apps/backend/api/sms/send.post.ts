import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, unlinkSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendRoot = join(__dirname, '../..');
const logFile = join(backendRoot, 'data/sms_log.json');

// 读取日志
function readLogs(): any[] {
  try {
    if (existsSync(logFile)) {
      return JSON.parse(readFileSync(logFile, 'utf-8'));
    }
  } catch {}
  return [];
}

// 写入日志
function writeLogs(logs: any[]) {
  const dataDir = join(backendRoot, 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf-8');
}

// 添加日志
function addLog(log: any) {
  const logs = readLogs();
  logs.unshift(log); // 新日志在前
  // 只保留最近500条
  if (logs.length > 500) {
    logs.length = 500;
  }
  writeLogs(logs);
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { phone, content, type, target, isTest } = body;

  if (!phone) {
    return { success: false, error: '手机号不能为空' };
  }

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return { success: false, error: '手机号格式不正确' };
  }

  // 构建短信内容
  let smsContent = '';
  if (isTest) {
    smsContent = `【测试】${content || '这是一条测试短信'}`;
  } else if (type === 'alert') {
    smsContent = `尊敬的运维工程师，监测到节点（${target || '未知'}）目前处于异常状态，请及时排查。`;
  } else if (type === 'recovery') {
    smsContent = `尊敬的运维工程师，监测到节点（${target || '未知'}）已恢复正常。`;
  } else {
    smsContent = content || '系统通知';
  }

  const utilsDir = join(backendRoot, 'utils');
  const tempScript = join(backendRoot, '_temp_sms.py');
  const pythonCode = `
import sys
import json
sys.path.insert(0, '${utilsDir}')
from sms_config import SmsNotify

sms = SmsNotify()
result = sms.send("${phone}", "${smsContent}", silent=True)
print(json.dumps(result))
`;

  const logEntry = {
    id: Date.now().toString(),
    time: new Date().toLocaleString('zh-CN'),
    phone,
    content: smsContent,
    type: type || 'custom',
    target: target || '',
    isTest: !!isTest,
    status: 'pending',
    error: '',
  };

  try {
    writeFileSync(tempScript, pythonCode, 'utf-8');
    
    const { stdout, stderr } = await execAsync(`python3 ${tempScript}`, {
      timeout: 15000,
      cwd: backendRoot,
    });

    try { unlinkSync(tempScript); } catch {}

    const result = JSON.parse(stdout.trim());
    
    logEntry.status = result.success ? 'sent' : 'failed';
    logEntry.error = result.error || '';
    addLog(logEntry);
    
    return {
      success: result.success,
      data: result.data || null,
      error: result.error || null,
      message: result.success ? '短信发送成功' : '短信发送失败',
    };
  } catch (error: any) {
    try { unlinkSync(tempScript); } catch {}
    
    logEntry.status = 'failed';
    logEntry.error = error.message || '发送异常';
    addLog(logEntry);
    
    return {
      success: false,
      error: error.message || '发送失败',
    };
  }
});
