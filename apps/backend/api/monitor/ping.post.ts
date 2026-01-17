import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as net from 'node:net';

const execAsync = promisify(exec);

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { address, protocol, port } = body;

  if (!address) {
    return { success: false, status: 'offline', rtt: 0, error: '地址不能为空' };
  }

  try {
    let result: { success: boolean; rtt: number };

    switch (protocol) {
      case 'TCP':
        // TCP: 先ping获取RTT，再检测端口是否开放
        result = await probeTCPWithPing(address, port || 80);
        break;
      case 'HTTP':
      case 'HTTPS':
        // HTTP/HTTPS: 使用ping获取RTT
        result = await pingICMP(address);
        break;
      case 'ICMP':
      default:
        // ICMP Ping
        result = await pingICMP(address);
        break;
    }

    return {
      success: true,
      status: result.success ? 'online' : 'offline',
      rtt: result.rtt,
    };
  } catch (error: any) {
    return { success: false, status: 'offline', rtt: 0, error: error.message };
  }
});

/**
 * ICMP Ping - 使用系统ping命令
 * 超时设置为1秒，确保刷新间隔准确
 */
async function pingICMP(address: string): Promise<{ success: boolean; rtt: number }> {
  try {
    // macOS: ping -c 1 -W 1000 (毫秒) - 1秒超时
    // Linux: ping -c 1 -W 1 (秒) - 1秒超时
    const cmd = process.platform === 'darwin' 
      ? `ping -c 1 -W 500 ${address}`  // 500ms超时，更快响应
      : `ping -c 1 -W 1 ${address}`;
    
    const { stdout } = await execAsync(cmd, { timeout: 1500 }); // 1.5秒总超时
    
    // 解析RTT: time=19.655 ms
    const match = stdout.match(/time[=<](\d+\.?\d*)\s*ms/i);
    if (match) {
      return { success: true, rtt: Math.round(parseFloat(match[1])) };
    }
    
    // 如果没匹配到时间但命令成功，说明在线
    return { success: true, rtt: 1 };
  } catch {
    return { success: false, rtt: 0 };
  }
}

/**
 * TCP探测 - 先ping获取RTT，再检测端口
 */
async function probeTCPWithPing(
  address: string, 
  port: number
): Promise<{ success: boolean; rtt: number }> {
  // 先检测端口是否开放
  const portOpen = await checkTCPPort(address, port);
  if (!portOpen) {
    return { success: false, rtt: 0 };
  }
  
  // 端口开放，使用ping获取RTT
  return await pingICMP(address);
}

/**
 * 检测TCP端口是否开放
 * 超时设置为500ms，更快响应
 */
function checkTCPPort(address: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500); // 500ms超时，更快响应
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.connect(port, address);
  });
}
