<template>
  <view class="logs-container">
    <!-- 页面头部 -->
    <view class="header">
      <view class="title">日志管理</view>
      <view class="subtitle">查看和上传本地日志文件</view>
    </view>

    <!-- 功能按钮区域 -->
    <view class="action-buttons">
      <button class="btn refresh-btn" @click="refreshLogList" :disabled="loading">
        <text class="btn-text">{{ loading ? '刷新中...' : '刷新列表' }}</text>
      </button>
      <button class="btn upload-btn" @click="uploadSelectedLogs" :disabled="selectedLogs.length === 0 || uploading">
        <text class="btn-text">{{ uploading ? '上传中...' : `上传选中 (${selectedLogs.length})` }}</text>
      </button>
    </view>

    <!-- 统计信息 -->
    <view class="stats">
      <view class="stat-item">
        <text class="stat-label">本地日志文件</text>
        <text class="stat-value">{{ logFiles.length }}</text>
      </view>
      <view class="stat-item">
        <text class="stat-label">总大小</text>
        <text class="stat-value">{{ totalSize }}</text>
      </view>
    </view>

    <!-- 日志文件列表 -->
    <view class="logs-list" v-if="logFiles.length > 0">
      <view class="list-header">
        <view class="checkbox-all" @click="toggleSelectAll">
          <text class="checkbox" :class="{ 'checked': isAllSelected }">{{ isAllSelected ? '☑' : '☐' }}</text>
          <text class="label">全选</text>
        </view>
      </view>
      
      <scroll-view class="scroll-list" scroll-y="true">
        <view 
          v-for="(logFile, index) in logFiles" 
          :key="index" 
          class="log-item"
          :class="{ 'selected': selectedLogs.includes(index) }"
          @click="toggleLogSelection(index)"
        >
          <view class="log-checkbox">
            <text class="checkbox" :class="{ 'checked': selectedLogs.includes(index) }">
              {{ selectedLogs.includes(index) ? '☑' : '☐' }}
            </text>
          </view>
          
          <view class="log-info">
            <view class="log-name">{{ logFile.name }}</view>
            <view class="log-details">
              <text class="detail-item">大小: {{ logFile.sizeFormatted }}</text>
              <text class="detail-item">修改时间: {{ logFile.mtimeFormatted }}</text>
            </view>
          </view>
          
          <view class="log-actions">
            <button class="action-btn view-btn" @click.stop="viewLogContent(logFile)">查看</button>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-else-if="!loading">
      <text class="empty-text">暂无日志文件</text>
      <text class="empty-hint">应用运行后会自动生成日志文件</text>
    </view>

    <!-- 加载状态 -->
    <view class="loading-state" v-if="loading">
      <text class="loading-text">正在加载日志文件...</text>
    </view>

    <!-- 日志内容弹窗 -->
    <view class="log-modal" v-if="showLogModal" @click="closeLogModal">
      <view class="modal-content" @click.stop="">
        <view class="modal-header">
          <text class="modal-title">{{ currentLogFile?.name }}</text>
          <button class="close-btn" @click="closeLogModal">×</button>
        </view>
        <scroll-view class="modal-body" scroll-y="true">
          <text class="log-content">{{ logContent }}</text>
        </scroll-view>
      </view>
    </view>

    <!-- 上传进度弹窗 -->
    <view class="upload-modal" v-if="showUploadModal">
      <view class="upload-content">
        <view class="upload-header">
          <text class="upload-title">上传进度</text>
        </view>
        <view class="upload-body">
          <view class="progress-info">
            <text class="progress-text">{{ uploadProgress.current }} / {{ uploadProgress.total }}</text>
            <text class="progress-detail">{{ uploadProgress.message }}</text>
          </view>
          <view class="progress-bar">
            <view class="progress-fill" :style="{ width: uploadProgress.percent + '%' }"></view>
          </view>
        </view>
        <view class="upload-footer" v-if="uploadCompleted">
          <button class="btn close-upload-btn" @click="closeUploadModal">关闭</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import LogManager from '../../utils/LogManager.js'
import request from '../../config/request.js'

export default {
  data() {
    return {
      logFiles: [],
      selectedLogs: [],
      loading: false,
      uploading: false,
      showLogModal: false,
      showUploadModal: false,
      uploadCompleted: false,
      currentLogFile: null,
      logContent: '',
      uploadProgress: {
        current: 0,
        total: 0,
        percent: 0,
        message: ''
      }
    }
  },
  
  computed: {
    totalSize() {
      const totalBytes = this.logFiles.reduce((sum, file) => sum + file.size, 0);
      return this.formatFileSize(totalBytes);
    },
    
    isAllSelected() {
      return this.logFiles.length > 0 && this.selectedLogs.length === this.logFiles.length;
    }
  },
  
  onLoad() {
          LogManager.log('进入日志管理页面', '2800');
    this.refreshLogList();
  },
  
  onUnload() {
          LogManager.log('退出日志管理页面', '2800');
  },
  
  methods: {
    // 刷新日志文件列表
    async refreshLogList() {
      this.loading = true;
      try {
        LogManager.log('开始刷新日志文件列表', '2800');
        this.logFiles = await LogManager.getLogFiles();
        this.selectedLogs = [];
        LogManager.log(`日志文件列表刷新完成，共${this.logFiles.length}个文件`, '2800');
      } catch (error) {
                  LogManager.log(`刷新日志文件列表失败: ${error}`, '2800');
        uni.showToast({
          title: '刷新失败',
          icon: 'none'
        });
      } finally {
        this.loading = false;
      }
    },
    
    // 切换日志选择状态
    toggleLogSelection(index) {
      const selectedIndex = this.selectedLogs.indexOf(index);
      if (selectedIndex > -1) {
        this.selectedLogs.splice(selectedIndex, 1);
      } else {
        this.selectedLogs.push(index);
      }
    },
    
    // 切换全选状态
    toggleSelectAll() {
      if (this.isAllSelected) {
        this.selectedLogs = [];
      } else {
        this.selectedLogs = this.logFiles.map((_, index) => index);
      }
    },
    
    // 查看日志内容
    async viewLogContent(logFile) {
      try {
        LogManager.log(`查看日志文件: ${logFile.name}`, '2800');
        this.currentLogFile = logFile;
        this.logContent = '正在加载...';
        this.showLogModal = true;
        
        // 读取文件内容
        const content = LogManager.readLogFile(logFile.path);
        this.logContent = content || '文件内容为空';
        
        LogManager.log(`日志文件内容加载完成: ${logFile.name}`, '2800');
      } catch (error) {
                  LogManager.log(`读取日志文件失败: ${error}`, '2800');
        this.logContent = '读取文件失败: ' + error;
      }
    },
    
    // 关闭日志内容弹窗
    closeLogModal() {
      this.showLogModal = false;
      this.currentLogFile = null;
      this.logContent = '';
    },
    
    // 上传选中的日志文件
    async uploadSelectedLogs() {
      if (this.selectedLogs.length === 0) {
        uni.showToast({
          title: '请选择要上传的日志文件',
          icon: 'none'
        });
        return;
      }
      
      // 显示确认对话框
      const confirmResult = await new Promise((resolve) => {
        uni.showModal({
          title: '确认上传',
          content: `确定要上传 ${this.selectedLogs.length} 个日志文件吗？`,
          success: (res) => resolve(res.confirm)
        });
      });
      
      if (!confirmResult) {
        return;
      }
      
      this.uploading = true;
      this.showUploadModal = true;
      this.uploadCompleted = false;
      
      this.uploadProgress = {
        current: 0,
        total: this.selectedLogs.length,
        percent: 0,
        message: '准备上传...'
      };
      
      LogManager.log(`开始批量上传日志文件，共${this.selectedLogs.length}个文件`, '2800');
      
      let successCount = 0;
      let failCount = 0;
      
      try {
        for (let i = 0; i < this.selectedLogs.length; i++) {
          const logIndex = this.selectedLogs[i];
          const logFile = this.logFiles[logIndex];
          
          this.uploadProgress.current = i + 1;
          this.uploadProgress.percent = Math.round((i + 1) / this.selectedLogs.length * 100);
          this.uploadProgress.message = `上传: ${logFile.name}`;
          
          try {
            await this.uploadSingleFile(logFile);
            successCount++;
            LogManager.log(`文件上传成功: ${logFile.name}`, '2800');
          } catch (error) {
            failCount++;
                          LogManager.log(`文件上传失败: ${logFile.name}, 错误: ${error}`, '2800');
          }
          
          // 添加小延迟避免过快的请求
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        this.uploadProgress.message = `上传完成 - 成功: ${successCount}, 失败: ${failCount}`;
        LogManager.log(`批量上传完成 - 成功: ${successCount}, 失败: ${failCount}`, '2800');
        
        uni.showToast({
          title: `上传完成 - 成功${successCount}个`,
          icon: successCount > 0 ? 'success' : 'none'
        });
        
      } catch (error) {
        LogManager.log(`批量上传异常: ${error}`, '2800');
        uni.showToast({
          title: '上传异常',
          icon: 'none'
        });
      } finally {
        this.uploading = false;
        this.uploadCompleted = true;
        this.selectedLogs = [];
      }
    },
    
    // 上传单个文件
    async uploadSingleFile(logFile) {
      return new Promise((resolve, reject) => {
        // 获取当前车间信息
        const workshop = uni.getStorageSync('currentWorkshop') || '2800';
        const deviceId = uni.getStorageSync('deviceId') || 'PDA_' + Date.now();
        
        uni.uploadFile({
          url: request.get('').replace('//', '//').split('//')[1] ? 
               `http://${request.get('').replace('//', '//').split('//')[1].split('/')[0]}/file/upload` :
               'http://192.168.1.9:7005/file/upload',
          filePath: logFile.path,
          name: 'file',
          formData: {
            'workshop': workshop,
            'deviceId': deviceId
          },
          success: (uploadRes) => {
            try {
              const result = JSON.parse(uploadRes.data);
              if (result.success || result.code === 200) {
                resolve(result);
              } else {
                reject(new Error(result.msg || result.message || '上传失败'));
              }
            } catch (parseError) {
              reject(new Error('解析响应失败'));
            }
          },
          fail: (error) => {
            reject(new Error(error.errMsg || '网络错误'));
          }
        });
      });
    },
    
    // 关闭上传进度弹窗
    closeUploadModal() {
      this.showUploadModal = false;
      this.uploadCompleted = false;
    },
    
    // 格式化文件大小
    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
  }
}
</script>

<style scoped>
.logs-container {
  background-color: #f5f7fa;
  min-height: 100vh;
  padding: 20rpx;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx 30rpx;
  border-radius: 16rpx;
  color: white;
  margin-bottom: 20rpx;
}

.title {
  font-size: 36rpx;
  font-weight: bold;
  margin-bottom: 10rpx;
}

.subtitle {
  font-size: 26rpx;
  opacity: 0.9;
}

.action-buttons {
  display: flex;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.btn {
  flex: 1;
  height: 80rpx;
  border-radius: 12rpx;
  border: none;
  font-size: 28rpx;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.refresh-btn {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.upload-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.btn[disabled] {
  opacity: 0.6;
}

.btn-text {
  color: white;
  font-size: 28rpx;
}

.stats {
  display: flex;
  background: white;
  border-radius: 12rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.1);
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 24rpx;
  color: #666;
  margin-bottom: 10rpx;
}

.stat-value {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.logs-list {
  background: white;
  border-radius: 12rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.1);
}

.list-header {
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
  background: #f8f9fa;
}

.checkbox-all {
  display: flex;
  align-items: center;
  gap: 15rpx;
}

.checkbox {
  font-size: 36rpx;
  color: #ccc;
}

.checkbox.checked {
  color: #667eea;
}

.label {
  font-size: 28rpx;
  color: #333;
}

.scroll-list {
  max-height: 800rpx;
}

.log-item {
  display: flex;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
  transition: background-color 0.2s;
}

.log-item:last-child {
  border-bottom: none;
}

.log-item.selected {
  background-color: #f0f4ff;
}

.log-checkbox {
  margin-right: 20rpx;
}

.log-info {
  flex: 1;
}

.log-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  margin-bottom: 10rpx;
}

.log-details {
  display: flex;
  flex-direction: column;
  gap: 5rpx;
}

.detail-item {
  font-size: 24rpx;
  color: #666;
}

.log-actions {
  margin-left: 20rpx;
}

.action-btn {
  padding: 12rpx 24rpx;
  border-radius: 8rpx;
  border: none;
  font-size: 24rpx;
  background: #667eea;
  color: white;
}

.empty-state, .loading-state {
  text-align: center;
  padding: 100rpx 0;
  color: #666;
}

.empty-text, .loading-text {
  font-size: 32rpx;
  margin-bottom: 20rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: #999;
}

/* 弹窗样式 */
.log-modal, .upload-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12rpx;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
}

.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  flex: 1;
}

.close-btn {
  font-size: 48rpx;
  background: none;
  border: none;
  color: #666;
  padding: 0;
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  flex: 1;
  padding: 30rpx;
  max-height: 60vh;
}

.log-content {
  font-size: 24rpx;
  line-height: 1.6;
  color: #333;
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

.upload-content {
  background: white;
  border-radius: 12rpx;
  width: 80%;
  padding: 30rpx;
}

.upload-header {
  text-align: center;
  margin-bottom: 30rpx;
}

.upload-title {
  font-size: 32rpx;
  font-weight: bold;
}

.upload-body {
  margin-bottom: 30rpx;
}

.progress-info {
  text-align: center;
  margin-bottom: 20rpx;
}

.progress-text {
  display: block;
  font-size: 28rpx;
  font-weight: bold;
  margin-bottom: 10rpx;
}

.progress-detail {
  display: block;
  font-size: 24rpx;
  color: #666;
}

.progress-bar {
  height: 16rpx;
  background: #eee;
  border-radius: 8rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s ease;
}

.upload-footer {
  text-align: center;
}

.close-upload-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 20rpx 60rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
}
</style>
