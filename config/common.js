// 公共服务器配置
const serverConfig = {
  // 服务器IP地址
  ip: {
    // development: 'localhost',  // 开发环境IP
    development: '192.168.1.9',  // 开发环境IP
    production: '10.120.50.99'    // 生产环境IP
  },
  
  // 各服务端口配置
  ports: {
    http: 7005,      // HTTP API服务端口
    websocket: 8081  // WebSocket服务端口
  },
  
  // 根据环境获取当前IP
  getCurrentIP() {
    return process.env.NODE_ENV === 'development' 
      ? this.ip.development 
      : this.ip.production;
  },
  
  // 获取HTTP服务完整地址
  getHttpUrl() {
    return `http://${this.getCurrentIP()}:${this.ports.http}`;
  },
  
  // 获取WebSocket服务完整地址
  getWebSocketUrl() {
    return `ws://${this.ip.development}:${this.ports.websocket}`;
  }
};

export default serverConfig; 