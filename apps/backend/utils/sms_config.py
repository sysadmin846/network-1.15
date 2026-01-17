"""
移动云MAS短信通知模块
王力安防科技股份有限公司

使用方法：
    from sms_notify import SmsNotify
    
    # 创建通知实例
    sms = SmsNotify()
    
    # 发送单条短信
    sms.send("13800138000", "这是通知内容")
    
    # 批量发送
    sms.send_batch(["13800138000", "13900139000"], "这是通知内容")
    
    # 发送告警通知
    sms.alert("13800138000", "192.168.1.1", "离线")
"""

import requests
import hashlib
import json
import base64
import urllib3
from datetime import datetime

# 禁用 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class SmsNotify:
    """移动云MAS短信通知类"""
    
    # 默认配置（王力安防）
    DEFAULT_CONFIG = {
        "url": "https://112.35.10.201:28888/sms/submit",
        "ec_name": "王力安防科技股份有限公司",
        "ap_id": "neosight",
        "secret_key": "WLjt@9090.",
        "sign": "09rkEvTqR",
        "timeout": 10
    }
    
    def __init__(self, config=None):
        """
        初始化短信通知
        
        :param config: 自定义配置字典，不传则使用默认配置
        """
        self.config = config or self.DEFAULT_CONFIG
    
    def _generate_mac(self, mobile, content):
        """生成MAC验证码"""
        add_serial = ""
        raw_str = (
            self.config["ec_name"] + 
            self.config["ap_id"] + 
            self.config["secret_key"] + 
            mobile + 
            content + 
            self.config["sign"] + 
            add_serial
        )
        return hashlib.md5(raw_str.encode('utf-8')).hexdigest().lower()
    
    def send(self, mobile, content, silent=False):
        """
        发送短信
        
        :param mobile: 手机号
        :param content: 短信内容（平台会自动添加签名前缀）
        :param silent: 静默模式，不打印日志
        :return: dict {"success": bool, "data": dict, "error": str}
        """
        mac = self._generate_mac(mobile, content)
        
        payload = {
            "ecName": self.config["ec_name"],
            "apId": self.config["ap_id"],
            "mobiles": mobile,
            "content": content,
            "sign": self.config["sign"],
            "addSerial": "",
            "mac": mac
        }
        
        if not silent:
            print(f"[{datetime.now()}] 发送短信到 {mobile}...")
        
        try:
            json_str = json.dumps(payload, ensure_ascii=False)
            encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
            
            response = requests.post(
                self.config["url"],
                data=encoded_data,
                timeout=self.config["timeout"],
                verify=False
            )
            
            result = response.json()
            
            if result.get("success"):
                if not silent:
                    print(f"✅ 发送成功 | 批次号: {result.get('msgGroup')}")
                return {"success": True, "data": result}
            else:
                if not silent:
                    print(f"❌ 发送失败 | 错误码: {result.get('rspcod')}")
                return {"success": False, "data": result}
                
        except requests.exceptions.Timeout:
            error = "请求超时"
            if not silent:
                print(f"⚠️ {error}")
            return {"success": False, "error": error}
            
        except requests.exceptions.ConnectionError:
            error = "网络连接失败"
            if not silent:
                print(f"⚠️ {error}")
            return {"success": False, "error": error}
            
        except Exception as e:
            error = str(e)
            if not silent:
                print(f"⚠️ 异常: {error}")
            return {"success": False, "error": error}
    
    def send_batch(self, mobiles, content, silent=False):
        """
        批量发送短信
        
        :param mobiles: 手机号列表
        :param content: 短信内容
        :param silent: 静默模式
        :return: list 每个手机号的发送结果
        """
        results = []
        for mobile in mobiles:
            result = self.send(mobile, content, silent)
            results.append({"mobile": mobile, "result": result})
        return results
    
    def alert(self, mobile, node, status, extra=""):
        """
        发送告警通知（预设模板）
        
        :param mobile: 手机号
        :param node: 节点名称/IP
        :param status: 状态（如：离线、异常、恢复）
        :param extra: 额外信息
        :return: dict 发送结果
        """
        content = f"尊敬的运维工程师，监测到节点（{node}）目前处于{status}状态，请及时排查。{extra}"
        return self.send(mobile, content)
    
    def notify(self, mobile, title, message):
        """
        发送通用通知
        
        :param mobile: 手机号
        :param title: 通知标题
        :param message: 通知内容
        :return: dict 发送结果
        """
        content = f"{title}：{message}"
        return self.send(mobile, content)


# 快捷函数（方便直接调用）
_default_sms = None

def get_sms():
    """获取默认短信实例"""
    global _default_sms
    if _default_sms is None:
        _default_sms = SmsNotify()
    return _default_sms

def send_sms(mobile, content):
    """快捷发送短信"""
    return get_sms().send(mobile, content)

def send_alert(mobile, node, status):
    """快捷发送告警"""
    return get_sms().alert(mobile, node, status)

def send_batch(mobiles, content):
    """快捷批量发送"""
    return get_sms().send_batch(mobiles, content)
