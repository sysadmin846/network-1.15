import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendRoot = join(__dirname, '../..');
const configFile = join(backendRoot, 'data/alert_config.json');

export default defineEventHandler(async () => {
  try {
    if (existsSync(configFile)) {
      const config = JSON.parse(readFileSync(configFile, 'utf-8'));
      return { success: true, data: config };
    }
  } catch {}
  
  // 默认配置
  return {
    success: true,
    data: {
      enabled: false,
      consecutiveFailures: 3,
      cooldownMinutes: 5,
      notifyOnRecovery: true,
      smsPhone: '',
      channels: { sms: true, inApp: true, email: false },
      selectedTargets: [],
      updatedAt: null,
    },
  };
});
