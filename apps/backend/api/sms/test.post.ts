import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, unlinkSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);

// 获取当前文件所在目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// 后端根目录 (apps/backend-mock)
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
  logs.unshift(log);
  if (logs.length > 500) {
    logs.length = 500;
  }
  writeLogs(logs);
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { phone, content, type } = body;

  if (!phone) {
    return {
      success: false,
      error: '手机号不能为空',
    };
  }

  // 验证手机号格式
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return {
      success: false,
      error: '手机号格式不正确',
    };
  }

  // 构建短信内容
  let smsContent = '';
  if (content && content.trim()) {
    // 如果用户输入了内容，优先使用用户输入的内容
    smsContent = content;
  } else if (type === 'alert') {
    smsContent = '【测试】尊敬的运维工程师，这是一条测试告警通知，请忽略。';
  } else if (type === 'recovery') {
    smsContent = '【测试】尊敬的运维工程师，这是一条测试恢复通知，请忽略。';
  } else {
    smsContent = '【测试】这是一条测试短信';
  }

  // 日志记录
  const logEntry = {
    id: Date.now().toString(),
    time: new Date().toLocaleString('zh-CN'),
    phone,
    content: smsContent,
    type: type || 'custom',
    target: '',
    isTest: true,
    status: 'pending',
    error: '',
  };

  // 创建临时Python脚本
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

  try {
    // 写入临时脚本
    writeFileSync(tempScript, pythonCode, 'utf-8');
    
    // 执行Python脚本
    const { stdout, stderr } = await execAsync(`python3 ${tempScript}`, {
      timeout: 15000,
      cwd: backendRoot,
    });

    // 删除临时脚本
    try {
      unlinkSync(tempScript);
    } catch {}

    if (stderr) {
      console.error('Python stderr:', stderr);
    }

    const result = JSON.parse(stdout.trim());
    
    // 更新日志状态
    logEntry.status = result.success ? 'sent' : 'failed';
    logEntry.error = result.error || '';
    addLog(logEntry);
    
    return {
      success: result.success,
      data: result.data || null,
      error: result.error || null,
      message: result.success ? '测试短信发送成功' : '测试短信发送失败',
    };
  } catch (error: any) {
    // 删除临时脚本
    try {
      unlinkSync(tempScript);
    } catch {}
    
    // 记录失败日志
    logEntry.status = 'failed';
    logEntry.error = error.message || '发送异常';
    addLog(logEntry);
    
    console.error('SMS send error:', error);
    return {
      success: false,
      error: error.message || '发送失败',
      message: '短信发送异常，请检查配置',
    };
  }
});
