/**
 * 移动端本地日志管理器
 * 简化版本，直接保存到本地文件
 */
class LogManager {
  constructor(config = {}) {
    this.config = {
      // 日志缓冲区大小
      bufferSize: config.bufferSize || 10,
      // 日志刷新间隔 (毫秒)
      flushInterval: config.flushInterval || 5000,
      // 最大文件大小 (MB)
      maxFileSize: config.maxFileSize || 10,
      // 日志保留天数
      retainDays: config.retainDays || 7,
      // 根目录名称
      baseDir: config.baseDir || 'wcs_logs'
    };
    
    // 日志缓冲区 - 按车间分别存储
    this.logBuffer = {
      '2800': [],
      '2500': []
    };
    
    // 刷新定时器
    this.flushTimer = null;
    
    // 初始化存储目录
    this.initStorage();
  }

  /**
   * 初始化存储目录
   */
  async initStorage() {
    try {
      // 获取应用目录路径
      const fs = uni.getFileSystemManager();
      
      // 兼容不同平台的用户数据路径
      let userDataPath;
      try {
        // #ifdef MP-WEIXIN
        userDataPath = wx.env.USER_DATA_PATH;
        // #endif
        // #ifndef MP-WEIXIN
        userDataPath = uni.env.USER_DATA_PATH || '/tmp';
        // #endif
      } catch (e) {
        userDataPath = '/tmp';
      }
      
      this.baseDir = `${userDataPath}/${this.config.baseDir}`;
      
      // 确保目录存在
      try {
        fs.accessSync(this.baseDir);
      } catch (e) {
        // 目录不存在，创建它
        fs.mkdirSync(this.baseDir, true);
      }
      
      console.log('日志存储目录初始化成功:', this.baseDir);
      
      // 清理过期日志
      await this.cleanOldLogs();
      
    } catch (error) {
      console.error('日志存储目录初始化失败:', error);
      // 如果无法创建目录，切换到内存模式
      this.baseDir = null;
    }
  }

  /**
   * 写入日志到本地
   * @param {String} logData 日志数据
   * @param {String} workshop 车间标识 ('2800' 或 '2500')
   */
  writeLog(logData, workshop = '2800') {
    try {
      // 创建日志条目
      const timestamp = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const logEntry = `[${timestamp}] [${workshop}车间] ${logData}\n`;

      // 添加到对应车间的缓冲区
      if (!this.logBuffer[workshop]) {
        this.logBuffer[workshop] = [];
      }
      this.logBuffer[workshop].push(logEntry);

      // 如果缓冲区满了，立即刷新
      if (this.logBuffer[workshop].length >= this.config.bufferSize) {
        this.flushLogBuffer(workshop);
      } else if (!this.flushTimer) {
        // 设置定时器，定期刷新缓冲区
        this.flushTimer = setTimeout(() => {
          this.flushAllLogBuffers();
        }, this.config.flushInterval);
      }
      
    } catch (error) {
      console.error('写入日志失败:', error);
    }
  }

  /**
   * 刷新指定车间的日志缓冲区
   * @param {String} workshop 车间标识
   */
  async flushLogBuffer(workshop) {
    if (!this.logBuffer[workshop] || this.logBuffer[workshop].length === 0) {
      return;
    }

    // 如果无法使用文件系统，只在内存中保留最近的日志
    if (!this.baseDir) {
      // 内存模式：只保留最近100条日志
      if (this.logBuffer[workshop].length > 100) {
        this.logBuffer[workshop] = this.logBuffer[workshop].slice(-100);
      }
      console.log(`${workshop}车间日志已缓存到内存:`, this.logBuffer[workshop].length, '条');
      return;
    }

    try {
      const fs = uni.getFileSystemManager();
      const logPath = this.getLogPath(workshop);

      // 检查文件大小，如果超过限制则轮转
      await this.checkAndRotateLog(logPath, workshop);

      // 批量写入日志
      const logContent = this.logBuffer[workshop].join('');
      
      try {
        // 追加写入文件
        fs.appendFileSync(logPath, logContent, 'utf8');
        console.log(`${workshop}车间日志写入成功:`, this.logBuffer[workshop].length, '条');
      } catch (appendError) {
        // 如果追加失败，可能是文件不存在，尝试创建文件
        try {
          fs.writeFileSync(logPath, logContent, 'utf8');
          console.log(`${workshop}车间日志文件创建成功`);
        } catch (writeError) {
          console.error(`无法写入日志文件，切换到内存模式:`, writeError);
          this.baseDir = null;
          return;
        }
      }

      // 清空缓冲区
      this.logBuffer[workshop] = [];

    } catch (error) {
      console.error(`刷新${workshop}车间日志缓冲区失败:`, error);
    }
  }

  /**
   * 刷新所有车间的日志缓冲区
   */
  async flushAllLogBuffers() {
    this.flushTimer = null;
    
    const promises = Object.keys(this.logBuffer).map(workshop => 
      this.flushLogBuffer(workshop)
    );
    
    await Promise.all(promises);
  }

  /**
   * 启动刷新定时器
   * @param {String} workshop 车间标识
   */
  startFlushTimer(workshop) {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    
    this.flushTimer = setTimeout(() => {
      this.flushAllLogBuffers();
    }, this.config.flushInterval);
  }

  /**
   * 获取日志文件路径
   * @param {String} workshop 车间标识
   * @returns {String} 日志文件路径
   */
  getLogPath(workshop) {
    const today = new Date().toISOString().split('T')[0];
    return `${this.baseDir}/${workshop}_${today}.txt`;
  }

  /**
   * 检查并轮转日志文件
   * @param {String} logPath 日志文件路径
   * @param {String} workshop 车间标识
   */
  async checkAndRotateLog(logPath, workshop) {
    try {
      const fs = uni.getFileSystemManager();
      
      // 检查文件是否存在
      try {
        const stats = fs.statSync(logPath);
        const fileSizeMB = stats.size / (1024 * 1024);
        
        // 如果文件超过最大大小，进行轮转
        if (fileSizeMB > this.config.maxFileSize) {
          const backupPath = logPath.replace('.txt', `_${Date.now()}.txt`);
          fs.renameSync(logPath, backupPath);
          console.log(`日志文件轮转: ${logPath} -> ${backupPath}`);
        }
      } catch (e) {
        // 文件不存在，不需要轮转
      }
    } catch (error) {
      console.error('检查日志文件轮转失败:', error);
    }
  }

  /**
   * 清理过期日志文件
   */
  async cleanOldLogs() {
    if (!this.baseDir) return;
    
    try {
      const fs = uni.getFileSystemManager();
      const files = fs.readdirSync(this.baseDir);
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - this.config.retainDays * 24 * 60 * 60 * 1000);
      
      for (const file of files) {
        if (file.endsWith('.txt')) {
          const filePath = `${this.baseDir}/${file}`;
          try {
            const stats = fs.statSync(filePath);
            if (stats.mtime < cutoffDate) {
              fs.unlinkSync(filePath);
              console.log(`删除过期日志文件: ${file}`);
            }
          } catch (fileError) {
            console.error(`处理文件${file}时出错:`, fileError);
          }
        }
      }
    } catch (error) {
      console.error('清理过期日志失败:', error);
    }
  }

  /**
   * 获取日志文件列表
   * @returns {Array} 日志文件信息数组
   */
  async getLogFiles() {
    try {
      // 如果无法使用文件系统，返回内存中的日志
      if (!this.baseDir) {
        const memoryLogs = [];
        Object.keys(this.logBuffer).forEach(workshop => {
          if (this.logBuffer[workshop] && this.logBuffer[workshop].length > 0) {
            memoryLogs.push({
              name: `${workshop}_内存日志.txt`,
              path: `memory://${workshop}`,
              size: this.logBuffer[workshop].join('').length,
              sizeFormatted: this.formatFileSize(this.logBuffer[workshop].join('').length),
              mtime: new Date(),
              mtimeFormatted: new Date().toLocaleString('zh-CN')
            });
          }
        });
        return memoryLogs;
      }
      
      const fs = uni.getFileSystemManager();
      const files = fs.readdirSync(this.baseDir);
      
      const logFiles = [];
      
      for (const file of files) {
        if (file.endsWith('.txt')) {
          const filePath = `${this.baseDir}/${file}`;
          try {
            const stats = fs.statSync(filePath);
            logFiles.push({
              name: file,
              path: filePath,
              size: stats.size,
              sizeFormatted: this.formatFileSize(stats.size),
              mtime: stats.mtime,
              mtimeFormatted: new Date(stats.mtime).toLocaleString('zh-CN')
            });
          } catch (fileError) {
            console.error(`获取文件${file}信息时出错:`, fileError);
          }
        }
      }
      
      // 按修改时间降序排列
      return logFiles.sort((a, b) => b.mtime - a.mtime);
      
    } catch (error) {
      console.error('获取日志文件列表时出错:', error);
      return [];
    }
  }

  /**
   * 读取日志文件内容
   * @param {String} filePath 文件路径
   * @returns {String} 文件内容
   */
  readLogFile(filePath) {
    try {
      // 处理内存模式的日志
      if (filePath.startsWith('memory://')) {
        const workshop = filePath.replace('memory://', '');
        if (this.logBuffer[workshop]) {
          return this.logBuffer[workshop].join('');
        }
        return '内存日志为空';
      }
      
      // 处理文件系统中的日志
      const fs = uni.getFileSystemManager();
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error('读取日志文件失败:', error);
      return `读取失败: ${error.message || error}`;
    }
  }

  /**
   * 格式化文件大小
   * @param {Number} bytes 字节数
   * @returns {String} 格式化后的文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 手动刷新日志 (在应用退出时调用)
   */
  async forceFlush() {
    console.log('强制刷新所有日志缓冲区...');
    await this.flushAllLogBuffers();
  }

  /**
   * 记录日志
   */
  log(message, workshop = '2800') {
    this.writeLog(message, workshop);
  }
}

// 创建全局日志管理器实例
const logManager = new LogManager();

// 测试日志功能
console.log('日志管理器初始化完成');
logManager.log('测试日志记录功能', '2800');
logManager.log('测试2500车间日志', '2500');

export default logManager;

