<template>
  <view class="log-modal-overlay" v-if="visible" @click="closeModal">
    <view class="log-modal-content" @click.stop>
      <!-- 弹窗头部 -->
      <view class="modal-header">
        <text class="modal-title">日志管理</text>
        <view class="header-actions">
          <view class="header-btn" :class="{ active: isAllSelected }" @tap="toggleSelectAll">
            <uni-icons :type="isAllSelected ? 'checkbox-filled' : 'circle'" size="16" color="#fff"></uni-icons>
            <text class="header-btn-text">全选</text>
          </view>
          <view class="header-btn" @tap="refreshFileList">
            <uni-icons type="refresh" size="16" color="#fff"></uni-icons>
            <text class="header-btn-text">刷新</text>
          </view>
          <view class="header-btn close" @tap="closeModal">
            <uni-icons type="close" size="18" color="#fff"></uni-icons>
          </view>
        </view>
      </view>

      <!-- 搜索栏 -->
      <view class="search-bar">
        <uni-icons type="search" size="18" color="#999" class="search-bar-icon"></uni-icons>
        <input 
          class="search-input" 
          type="text" 
          placeholder="搜索日志文件名..." 
          v-model="searchKeyword"
          @confirm="handleSearch"
          confirm-type="search"
        />
        <view class="search-btn clear-search" @tap="clearSearch" v-if="searchKeyword">
          <text class="search-btn-text">清除</text>
        </view>
      </view>

      <!-- 日志文件列表 -->
      <scroll-view scroll-y class="file-list">
        <!-- 加载中 -->
        <view class="loading-container" v-if="loading">
          <view class="loading-spinner"></view>
          <text class="loading-text">加载中...</text>
        </view>

        <!-- 空状态 -->
        <view class="empty-state" v-if="!loading && fileList.length === 0">
          <uni-icons type="list" size="44" color="#d1d5db" class="empty-icon"></uni-icons>
          <text class="empty-text">暂无日志文件</text>
          <text class="empty-desc">运行中的操作日志将自动保存至此</text>
        </view>

        <!-- 搜索无结果 -->
        <view class="empty-state" v-if="!loading && fileList.length > 0 && searchKeyword && filteredFileList.length === 0">
          <uni-icons type="search" size="44" color="#d1d5db" class="empty-icon"></uni-icons>
          <text class="empty-text">未找到匹配的日志文件</text>
          <text class="empty-desc">请尝试其他文件名关键词</text>
        </view>

        <!-- 文件卡片列表 -->
        <view 
          class="file-card" 
          v-for="file in filteredFileList" 
          :key="file.name"
          @click="viewLogFile(file)"
        >
          <view class="file-checkbox" @tap.stop="toggleFileSelect(file)">
            <view class="checkbox-wrap" :class="{ checked: selectedFiles.has(file.name) }">
              <uni-icons v-if="selectedFiles.has(file.name)" type="checkmarkempty" size="14" color="#fff"></uni-icons>
            </view>
          </view>
          <view class="file-icon">
            <uni-icons type="bars" size="22" color="#1a2a6c"></uni-icons>
          </view>
          <view class="file-info">
            <text class="file-name">{{ file.name }}</text>
            <view class="file-meta">
              <text class="file-workshop-tag" :class="'workshop-' + file.workshop">{{ file.workshop }}车间</text>
              <text class="meta-divider">|</text>
              <text class="file-size">{{ file.sizeText }}</text>
              <text class="meta-divider">|</text>
              <text class="file-time">{{ file.lastModifiedText || file.date }}</text>
            </view>
          </view>
          <view class="file-actions">
            <view class="delete-btn" @tap.stop="confirmDeleteFile(file)">
              <uni-icons type="trash-filled" size="22" color="#d63031"></uni-icons>
            </view>
          </view>
        </view>
      </scroll-view>

      <!-- 底部上传按钮 -->
      <view class="bottom-bar">
        <view class="selected-info" v-if="selectedFiles.size > 0">
          <text class="selected-count">已选 {{ selectedFiles.size }} 个文件</text>
        </view>
        <view class="bottom-btn upload-btn" :class="{ disabled: selectedFiles.size === 0 || uploading }" @tap="uploadSelectedFiles">
          <uni-icons v-if="uploading" type="spinner-cycle" size="20" color="#fff" class="spin-icon"></uni-icons>
          <text class="bottom-btn-text">{{ uploading ? '上传中...' : '上传日志到服务器' }}</text>
        </view>
      </view>
    </view>

    <!-- 日志内容查看弹窗 (嵌套) -->
    <view class="content-modal-overlay" v-if="showContentModal" @tap="closeContentModal">
      <view class="content-modal" @tap.stop>
        <view class="content-modal-header">
          <text class="content-modal-title">{{ currentFile.name }}</text>
          <view class="icon-btn" @tap="closeContentModal">
            <uni-icons type="close" size="24" color="#999"></uni-icons>
          </view>
        </view>
        <view class="content-modal-info">
          <text class="info-tag" :class="'workshop-' + currentFile.workshop">{{ currentFile.workshop }}车间</text>
          <text class="info-size">{{ currentFile.sizeText }}</text>
          <text class="info-lines">{{ logContentLines }} 行</text>
        </view>
        <view class="content-modal-body-wrap">
          <scroll-view scroll-y class="content-modal-body" :show-scrollbar="true">
            <view class="log-content-inner" v-if="logContent">
              <text class="log-content" selectable>{{ logContent }}</text>
            </view>
            <view class="log-content-inner" v-else>
              <text class="log-content-empty">文件为空或读取失败</text>
            </view>
          </scroll-view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import LogFileUtil from '@/utils/LogFileUtil.js'
import serverConfig from '@/config/common.js'

export default {
  name: 'LogManageModal',
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      loading: false,
      fileList: [],
      searchKeyword: '',
      showContentModal: false,
      currentFile: {},
      logContent: '',
      selectedFiles: new Set(),
      uploading: false
    }
  },
  computed: {
    sortedFileList() {
      const list = [...this.fileList]
      return list.sort((a, b) => b.date.localeCompare(a.date))
    },
    filteredFileList() {
      const kw = this.searchKeyword.trim().toLowerCase()
      if (!kw) {
        return this.sortedFileList
      }
      return this.sortedFileList.filter(f => f.name.toLowerCase().includes(kw))
    },
    logContentLines() {
      if (!this.logContent) return 0
      return this.logContent.split('\n').filter(l => l.trim()).length
    },
    isAllSelected() {
      if (this.filteredFileList.length === 0) return false
      return this.filteredFileList.every(f => this.selectedFiles.has(f.name))
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        if (!this.logUtil) {
          this.logUtil = LogFileUtil.getInstance()
        }
        this.refreshFileList()
      } else {
        this.clearSearch()
        this.selectedFiles = new Set()
      }
    }
  },
  methods: {
    closeModal() {
      this.$emit('update:visible', false)
      this.$emit('close')
    },

    async refreshFileList() {
      this.loading = true
      try {
        const fileList = await this.logUtil.getLogFileList()
        this.fileList = fileList
      } catch (error) {
        console.error('获取日志文件列表失败:', error)
        uni.showToast({ title: '获取日志列表失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },

    async viewLogFile(file) {
      this.currentFile = file
      this.showContentModal = true
      try {
        const content = await this.logUtil.readLogFile(file.name)
        this.logContent = content || '文件为空'
      } catch (error) {
        console.error('读取日志文件失败:', error)
        this.logContent = '读取失败'
      }
    },

    closeContentModal() {
      this.showContentModal = false
      this.currentFile = {}
      this.logContent = ''
    },

    confirmDeleteFile(file) {
      uni.showModal({
        title: '确认删除',
        content: `确定要删除日志文件 ${file.name} 吗？此操作不可恢复。`,
        confirmColor: '#d63031',
        success: async (res) => {
          if (res.confirm) {
            try {
              await this.logUtil.deleteLogFile(file.name)
              uni.showToast({ title: '删除成功', icon: 'success' })
              this.refreshFileList()
            } catch (error) {
              console.error('删除日志文件失败:', error)
              uni.showToast({ title: '删除失败', icon: 'none' })
            }
          }
        }
      })
    },

    handleSearch() {
      const kw = this.searchKeyword.trim()
      if (!kw) return
      if (this.filteredFileList.length === 0) {
        uni.showToast({ title: '未找到匹配的文件', icon: 'none' })
      }
    },

    clearSearch() {
      this.searchKeyword = ''
    },

    toggleFileSelect(file) {
      if (this.selectedFiles.has(file.name)) {
        this.selectedFiles.delete(file.name)
      } else {
        this.selectedFiles.add(file.name)
      }
      // 触发响应式更新
      this.selectedFiles = new Set(this.selectedFiles)
    },

    toggleSelectAll() {
      if (this.isAllSelected) {
        // 取消全选 - 移除当前过滤列表中的文件
        this.filteredFileList.forEach(f => this.selectedFiles.delete(f.name))
      } else {
        // 全选当前过滤列表
        this.filteredFileList.forEach(f => this.selectedFiles.add(f.name))
      }
      this.selectedFiles = new Set(this.selectedFiles)
    },

    async uploadSelectedFiles() {
      if (this.selectedFiles.size === 0 || this.uploading) return

      const selectedNames = [...this.selectedFiles]
      uni.showModal({
        title: '确认上传',
        content: `确定要将选中的 ${selectedNames.length} 个日志文件上传到服务器吗？`,
        success: async (res) => {
          if (res.confirm) {
            this.uploading = true
            let successCount = 0
            let failCount = 0

            for (const fileName of selectedNames) {
              try {
                await this.uploadSingleFile(fileName)
                successCount++
              } catch (error) {
                console.error('上传文件失败:', fileName, error)
                failCount++
              }
            }

            this.uploading = false
            this.selectedFiles = new Set()

            if (failCount === 0) {
              uni.showToast({ title: `${successCount}个文件上传成功`, icon: 'success' })
            } else {
              uni.showToast({ title: `成功${successCount}个，失败${failCount}个`, icon: 'none', duration: 3000 })
            }
          }
        }
      })
    },

    uploadSingleFile(fileName) {
      return new Promise((resolve, reject) => {
        // #ifdef APP-PLUS
        this.logUtil.initLogDir().then((dirEntry) => {
          dirEntry.getFile(
            fileName,
            { create: false },
            (fileEntry) => {
              const localUrl = fileEntry.toLocalURL()
              const workshop = fileName.match(/^(\d+)_/)
              const workshopVal = workshop ? workshop[1] : '2800'
              const baseUrl = serverConfig.getHttpUrl()

              const uploadTask = uni.uploadFile({
                url: baseUrl + '/file/mobileUpload',
                filePath: localUrl,
                name: 'file',
                formData: {
                  workshop: workshopVal
                },
                timeout: 60000,
                success: (res) => {
                  if (res.statusCode === 200) {
                    try {
                      const data = JSON.parse(res.data)
                      if (data.code === '200') {
                        console.log('文件上传成功:', fileName)
                        resolve(data)
                      } else {
                        console.error('文件上传失败:', data.message)
                        reject(new Error(data.message || '上传失败'))
                      }
                    } catch (e) {
                      console.error('解析上传响应失败:', e)
                      reject(e)
                    }
                  } else {
                    reject(new Error('HTTP状态码: ' + res.statusCode))
                  }
                },
                fail: (err) => {
                  console.error('上传请求失败:', err)
                  reject(err)
                }
              })

              // 可通过 uploadTask.abort() 取消上传
            },
            (error) => {
              console.error('获取文件失败:', fileName, error)
              reject(error)
            }
          )
        }).catch(reject)
        // #endif
        // #ifndef APP-PLUS
        reject(new Error('非APP环境，不支持文件上传'))
        // #endif
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.log-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.log-modal-content {
  width: 92%;
  height: 85vh;
  background: #f5f7fa;
  border-radius: 16rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 30rpx;
  background: linear-gradient(90deg, #1a2a6c, #b21f1f);
  color: #fff;
  
  .modal-title {
    font-size: 32rpx;
    font-weight: 600;
  }
  
  .header-actions {
    display: flex;
    align-items: center;
    
    .header-btn {
      display: flex;
      align-items: center;
      padding: 10rpx 20rpx;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 30rpx;
      margin-left: 16rpx;
      
      .header-btn-text {
        font-size: 24rpx;
        color: #fff;
        margin-left: 6rpx;
      }
      
      &:active {
        background: rgba(255, 255, 255, 0.3);
      }
      
      &.active {
        background: rgba(255, 255, 255, 0.3);
      }
      
      &.close {
        padding: 10rpx 14rpx;
        border-radius: 50%;
      }
    }
  }
}

.search-bar {
  margin: 20rpx 20rpx 16rpx;
  background: #fff;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
  box-sizing: border-box;

  .search-bar-icon {
    margin-right: 12rpx;
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    height: 60rpx;
    font-size: 28rpx;
    color: #333;
  }

  .search-btn {
    margin-left: 16rpx;
    padding: 12rpx 24rpx;
    border-radius: 8rpx;
    .search-btn-text {
      font-size: 26rpx;
    }
  }

  .clear-search {
    background: #f0f0f0;
    .search-btn-text {
      color: #666;
    }
  }
}



.file-list {
  flex: 1;
  height: 0;
  padding: 0 20rpx 20rpx;
  box-sizing: border-box;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 0;
  .loading-spinner {
    width: 50rpx;
    height: 50rpx;
    border: 4rpx solid #e0e0e0;
    border-top: 4rpx solid #1a2a6c;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20rpx;
  }
  .loading-text {
    font-size: 26rpx;
    color: #999;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 150rpx 0;
  .empty-icon {
    margin-bottom: 20rpx;
  }
  .empty-text {
    font-size: 30rpx;
    color: #666;
    margin-bottom: 10rpx;
  }
  .empty-desc {
    font-size: 22rpx;
    color: #999;
  }
}

.file-card {
  box-sizing: border-box;
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx 20rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.03);
  display: flex;
  align-items: center;
  transition: all 0.2s ease;

  &:active {
    background: #f8f9fa;
  }

  .file-checkbox {
    margin-right: 20rpx;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8rpx;
  }

  .checkbox-wrap {
    width: 40rpx;
    height: 40rpx;
    border-radius: 8rpx;
    border: 3rpx solid #d1d5db;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    background: #fff;

    &.checked {
      background: #1a2a6c;
      border-color: #1a2a6c;
    }
  }

  .file-icon {
    margin-right: 20rpx;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .file-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .file-name {
      font-size: 28rpx;
      color: #333;
      font-weight: 500;
      margin-bottom: 12rpx;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;

      .file-workshop-tag {
        font-size: 20rpx;
        padding: 4rpx 12rpx;
        border-radius: 6rpx;
        color: #fff;
        font-weight: 500;
        margin-right: 12rpx;

        &.workshop-2800 {
          background: #2563eb;
        }
        &.workshop-2500 {
          background: #16a34a;
        }
      }

      .meta-divider {
        color: #ddd;
        font-size: 20rpx;
        margin-right: 12rpx;
      }

      .file-size {
        font-size: 22rpx;
        color: #888;
        margin-right: 12rpx;
      }
      
      .file-time {
        font-size: 22rpx;
        color: #888;
      }
    }
  }

  .file-actions {
    margin-left: 20rpx;
    padding-left: 20rpx;
    border-left: 1rpx solid #f0f0f0;

    .delete-btn {
      width: 72rpx;
      height: 72rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: #fff0f0;

      &:active {
        background: #ffe0e0;
      }
    }
  }
}

// 日志内容查看弹窗
.content-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.content-modal {
  width: 88%;
  max-width: 100%;
  height: 80%;
  max-height: 80%;
  background: #fff;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;

  .content-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24rpx 30rpx;
    border-bottom: 1rpx solid #eee;
    flex-shrink: 0;

    .content-modal-title {
      flex: 1;
      min-width: 0;
      font-size: 30rpx;
      font-weight: 600;
      color: #333;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-right: 16rpx;
    }

    .icon-btn {
      flex-shrink: 0;
      padding: 10rpx;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .content-modal-info {
    display: flex;
    padding: 16rpx 24rpx;
    background: #f8f9fa;
    flex-wrap: wrap;
    flex-shrink: 0;

    .info-tag {
      font-size: 20rpx;
      padding: 4rpx 12rpx;
      border-radius: 20rpx;
      color: #fff;
      margin-right: 12rpx;
      &.workshop-2800 { background: #2563eb; }
      &.workshop-2500 { background: #16a34a; }
    }

    .info-size {
      font-size: 20rpx;
      color: #666;
      background: #e8e8e8;
      padding: 4rpx 10rpx;
      border-radius: 10rpx;
      margin-right: 12rpx;
    }
    
    .info-lines {
      font-size: 20rpx;
      color: #666;
      background: #e8e8e8;
      padding: 4rpx 10rpx;
      border-radius: 10rpx;
    }
  }

  .content-modal-body-wrap {
    flex: 1;
    height: 0;
    min-height: 0;
    width: 100%;
    overflow: hidden;
    box-sizing: border-box;
  }

  .content-modal-body {
    height: 100%;
    width: 100%;
    box-sizing: border-box;
  }

  .log-content-inner {
    padding: 20rpx 24rpx;
    box-sizing: border-box;
    width: 100%;
  }

  .log-content {
    display: block;
    width: 100%;
    box-sizing: border-box;
    font-size: 22rpx;
    color: #333;
    font-family: 'Courier New', monospace;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
    overflow-wrap: break-word;
  }

  .log-content-empty {
    display: block;
    width: 100%;
    box-sizing: border-box;
    font-size: 26rpx;
    color: #999;
    text-align: center;
    padding: 60rpx 0;
  }
}

// 底部上传按钮栏
.bottom-bar {
  flex-shrink: 0;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1rpx solid #f0f0f0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  box-sizing: border-box;

  .selected-info {
    display: flex;
    justify-content: center;
    margin-bottom: 16rpx;

    .selected-count {
      font-size: 24rpx;
      color: #1a2a6c;
      font-weight: 500;
    }
  }

  .bottom-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24rpx 0;
    border-radius: 12rpx;
    transition: all 0.2s ease;

    .bottom-btn-text {
      font-size: 30rpx;
      font-weight: 600;
      color: #fff;
    }

    .spin-icon {
      margin-right: 12rpx;
      animation: spin 1s linear infinite;
    }

    &:active {
      opacity: 0.9;
    }

    &.upload-btn {
      background: linear-gradient(90deg, #1a2a6c, #b21f1f);
    }

    &.disabled {
      background: #ccc;
      pointer-events: none;
    }
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
