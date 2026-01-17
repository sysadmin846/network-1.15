import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendRoot = join(__dirname, '../..');
const configFile = join(backendRoot, 'data/alert_config.json');

function ensureDataDir() {
  const dataDir = join(backendRoot, 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  ensureDataDir();
  
  const config = {
    enabled: body.enabled ?? true,
    consecutiveFailures: body.consecutiveFailures ?? 3,
    cooldownMinutes: body.cooldownMinutes ?? 5,
    notifyOnRecovery: body.notifyOnRecovery ?? true,
    smsPhone: body.smsPhone || '',
    channels: body.channels || { sms: true, inApp: true, email: false },
    selectedTargets: body.selectedTargets || [],
    updatedAt: new Date().toLocaleString('zh-CN'),
  };
  
  writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');
  
  return {
    success: true,
    message: '配置保存成功',
    data: config,
  };
});
