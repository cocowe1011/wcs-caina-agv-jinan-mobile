import serverConfig from '../config/common.js'

class AlarmWebSocketClient {
  constructor(config = {}) {
    this.url = serverConfig.getWebSocketUrl(); // 使用公共配置的WebSocket地址
    this.workshop = config.workshop || '2800'; // 车间标识：'2500' 或 '2800'
    this.socketTask = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000; // 3秒
    this.heartbeatInterval = null;
    this.pingTimer = null;
    
    // 事件回调
    this.onConnected = config.onConnected || null;
    this.onDisconnected = config.onDisconnected || null;
    this.onAlarmReceived = config.onAlarmReceived || null;
    this.onError = config.onError || null;
    
    this.alarmLogs = []; // 存储接收到的报警日志
  }

  // 连接WebSocket服务器
  connect() {
    try {
      console.log(`尝试连接WebSocket服务器: ${this.url}`);
      
      this.socketTask = uni.connectSocket({
        url: this.url,
        success: () => {
          console.log('WebSocket连接请求已发送');
        },
        fail: (error) => {
          console.error('WebSocket连接请求失败:', error);
          if (this.onError) {
            this.onError(error);
          }
        }
      });
      
      // 监听WebSocket连接打开事件
      this.socketTask.onOpen((res) => {
        console.log('WebSocket连接已建立');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // 注册车间信息
        this.register();
        
        // 启动心跳
        this.startHeartbeat();
        
        if (this.onConnected) {
          this.onConnected(res);
        }
      });

      // 监听WebSocket接受到服务器的消息事件
      this.socketTask.onMessage((res) => {
        try {
          const data = JSON.parse(res.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('解析消息失败:', error);
        }
      });

      // 监听WebSocket连接关闭事件
      this.socketTask.onClose((res) => {
        console.log('WebSocket连接已关闭:', res.code, res.reason);
        this.isConnected = false;
        this.stopHeartbeat();
        
        if (this.onDisconnected) {
          this.onDisconnected(res);
        }
        
        // 自动重连
        this.attemptReconnect();
      });

      // 监听WebSocket错误事件
      this.socketTask.onError((error) => {
        console.error('WebSocket错误:', error);
        
        if (this.onError) {
          this.onError(error);
        }
      });

    } catch (error) {
      console.error('WebSocket连接失败:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  // 注册车间信息
  register() {
    if (this.isConnected) {
      const message = {
        type: 'register',
        workshop: this.workshop
      };
      this.send(message);
    }
  }

  // 处理收到的消息
  handleMessage(data) {
    console.log('收到消息:', data);
    
    switch (data.type) {
      case 'connected':
        console.log('服务器确认连接:', data.message);
        break;
        
      case 'registered':
        console.log('车间注册成功:', data.message);
        break;
        
      case 'alarm':
        // 处理报警消息
        this.handleAlarmMessage(data);
        break;
        
      case 'pong':
        // 心跳响应
        break;
        
      default:
        console.log('未知消息类型:', data.type);
    }
  }

  // 处理报警消息
  handleAlarmMessage(data) {
    if (data.workshop === this.workshop) {
      const alarmLog = {
        id: data.data.id,
        message: data.data.message,
        timestamp: data.data.timestamp,
        source: data.data.source,
        type: data.data.type,
        receivedAt: new Date().toISOString(),
        unread: true
      };
      
      // 添加到本地报警日志列表
      this.alarmLogs.unshift(alarmLog);
      
      // 保持日志数量在合理范围内
      if (this.alarmLogs.length > 100) {
        this.alarmLogs.pop();
      }
      // 触发回调
      if (this.onAlarmReceived) {
        this.onAlarmReceived(alarmLog);
      }
    }
  }

  // 发送消息
  send(message) {
    if (this.socketTask && this.isConnected) {
      this.socketTask.send({
        data: JSON.stringify(message),
        success: () => {
          // console.log('消息发送成功');
        },
        fail: (error) => {
          console.error('消息发送失败:', error);
        }
      });
      return true;
    } else {
      console.warn('WebSocket未连接，无法发送消息');
      return false;
    }
  }

  // 启动心跳
  startHeartbeat() {
    this.stopHeartbeat(); // 先停止之前的心跳
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' });
      }
    }, 15000); // 每15秒发送一次心跳
  }

  // 停止心跳
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // 尝试重连
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.log('达到最大重连次数，停止重连');
    }
  }

  // 断开连接
  disconnect() {
    this.stopHeartbeat();
    
    if (this.socketTask) {
      this.socketTask.close({
        code: 1000,
        reason: '主动断开连接',
        success: () => {
          console.log('WebSocket连接已主动关闭');
        },
        fail: (error) => {
          console.error('关闭WebSocket连接失败:', error);
        }
      });
      this.socketTask = null;
    }
    
    this.isConnected = false;
    this.reconnectAttempts = this.maxReconnectAttempts; // 阻止自动重连
  }

  // 获取连接状态
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      workshop: this.workshop,
      url: this.url,
      reconnectAttempts: this.reconnectAttempts,
      alarmCount: this.alarmLogs.length,
      unreadCount: this.alarmLogs.filter(log => log.unread).length
    };
  }

  // 获取报警日志
  getAlarmLogs() {
    return this.alarmLogs;
  }

  // 标记报警为已读
  markAlarmsAsRead() {
    this.alarmLogs.forEach(log => {
      log.unread = false;
    });
  }

  // 清空报警日志
  clearAlarmLogs() {
    this.alarmLogs = [];
  }

  // 设置车间
  setWorkshop(workshop) {
    this.workshop = workshop;
    // 如果已连接，重新注册
    if (this.isConnected) {
      this.register();
    }
  }

  // 更新连接地址
  updateUrl(url) {
    const wasConnected = this.isConnected;
    
    // 先断开当前连接
    if (wasConnected) {
      this.disconnect();
    }
    
    // 更新URL
    this.url = url;
    
    // 如果之前是连接状态，重新连接
    if (wasConnected) {
      this.reconnectAttempts = 0; // 重置重连计数
      setTimeout(() => {
        this.connect();
      }, 1000);
    }
  }
}

export default AlarmWebSocketClient; 