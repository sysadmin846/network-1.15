import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from '../../utils/db';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendRoot = join(__dirname, '../..');

// 发送短信
async function sendSms(phone: string, content: string): Promise<{ success: boolean; error?: string }> {
  const utilsDir = join(backendRoot, 'utils');
  const tempScript = join(backendRoot, '_temp_alert_sms.py');
  const pythonCode = `
import sys
import json
sys.path.insert(0, '${utilsDir}')
from sms_config import SmsNotify

sms = SmsNotify()
result = sms.send("${phone}", "${content}", silent=True)
print(json.dumps(result))
`;

  try {
    writeFileSync(tempScript, pythonCode, 'utf-8');
    const { stdout } = await execAsync(`python3 ${tempScript}`, {
      timeout: 15000,
      cwd: backendRoot,
    });
    try { unlinkSync(tempScript); } catch {}
    return JSON.parse(stdout.trim());
  } catch (error: any) {
    try { unlinkSync(tempScript); } catch {}
    return { success: false, error: error.message };
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { type, targetKey, targetName, targetAddress, phone, offlineTime, recoveryTime } = body;
  
  // type: 'alert' | 'recovery'
  
  let smsContent = '';
  if (type === 'alert') {
    smsContent = `尊敬的运维工程师，监测到节点（${targetName} - ${targetAddress}）于 ${offlineTime || '未知时间'} 断线，目前处于异常状态，请及时排查。`;
  } else if (type === 'recovery') {
    smsContent = `尊敬的运维工程师，监测到节点（${targetName} - ${targetAddress}）已于 ${recoveryTime || '未知时间'} 恢复正常。断线时间: ${offlineTime || '未知'}`;
  }
  
  let smsStatus = 'pending';
  let smsError = '';
  
  // 发送短信
  if (phone) {
    const smsResult = await sendSms(phone, smsContent);
    smsStatus = smsResult.success ? 'sent' : 'failed';
    smsError = smsResult.error || '';
  } else {
    smsStatus = 'skipped';
  }
  
  // 保存告警日志到数据库
  try {
    const pool = getPool();
    const [result] = await pool.query(`
      INSERT INTO alert_logs (type, target_key, target_name, target_address, offline_time, recovery_time, content, sms_status, sms_error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [type, targetKey, targetName, targetAddress, offlineTime || '', recoveryTime || '', smsContent, smsStatus, smsError]) as any;
    
    const alertLog = {
      id: result.insertId,
      time: new Date().toLocaleString('zh-CN'),
      type,
      targetKey,
      targetName,
      targetAddress,
      offlineTime: offlineTime || '',
      recoveryTime: recoveryTime || '',
      content: smsContent,
      smsStatus,
      smsError,
    };
    
    return {
      success: true,
      data: alertLog,
    };
  } catch (error: any) {
    console.error('保存告警日志失败:', error);
    return {
      success: false,
      error: error.message || '保存告警日志失败',
    };
  }
});
