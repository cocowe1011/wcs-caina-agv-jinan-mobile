<template>
  <view class="login-container">
    <!-- Loading 遮罩 -->
    <view class="loading-mask" v-if="loading">
      <view class="loading-content">
        <view class="loading-icon"></view>
        <text class="loading-text">登录中...</text>
      </view>
    </view>
    
    <view class="login-content">
      <view class="login-header">
        <image class="logo" src="/static/images/logo.png" mode="aspectFit"></image>
        <text class="title" @longpress="showConfigDialog">移动WCS管理系统</text>
        <text class="subtitle">Intelligent Workshop Management</text>
      </view>
      
      <view class="login-form">
        <view class="input-item">
          <text class="iconfont icon-user"></text>
          <input 
            class="input" 
            v-model="username" 
            placeholder="请输入用户名"
            placeholder-class="placeholder"
            :disabled="loading"
          />
        </view>
        <view class="input-item">
          <text class="iconfont icon-password"></text>
          <input 
            class="input" 
            v-model="password" 
            type="password" 
            placeholder="请输入密码"
            placeholder-class="placeholder"
            :disabled="loading"
          />
        </view>
        
        <button 
          class="login-btn" 
          :class="{ loading }"
          @tap="handleLogin"
          :disabled="loading || !username || !password"
        >
          <loading-spin v-if="loading" size="32" color="#fff"></loading-spin>
          <text v-else>登 录</text>
        </button>
      </view>
      
      <view class="login-footer">
        <text class="version">Version 1.0.0</text>
        <text class="workshop-info" v-if="currentWorkshop">当前车间：{{ currentWorkshop }}</text>
      </view>
    </view>
    
    <!-- 配置弹窗 -->
    <view class="config-modal" v-if="showConfig">
      <view class="config-content">
        <view class="config-header">
          <text class="config-title">系统配置</text>
          <text class="config-close" @tap="hideConfigDialog">✕</text>
        </view>
        
        <view class="config-form">
          <view class="config-item">
            <text class="config-label">管理员密码:</text>
            <input 
              class="config-input" 
              v-model="configPassword" 
              type="password" 
              placeholder="请输入管理员密码"
            />
          </view>
          
          <view class="config-item" v-if="isConfigAuthed">
            <text class="config-label">选择车间:</text>
            <view class="workshop-options">
              <view
                class="workshop-option"
                :class="{ active: selectedWorkshop === '2800车间' }"
                @tap="selectWorkshop('2800车间')"
              >
                <text>2800车间</text>
              </view>
              <view
                class="workshop-option"
                :class="{ active: selectedWorkshop === '2500车间' }"
                @tap="selectWorkshop('2500车间')"
              >
                <text>2500车间</text>
              </view>
            </view>
          </view>
        </view>
        
        <view class="config-actions">
          <button class="config-btn cancel-btn" @tap="hideConfigDialog">取消</button>
          <button 
            class="config-btn confirm-btn" 
            @tap="saveConfig"
            :disabled="!configPassword"
          >
            {{ isConfigAuthed ? '保存配置' : '验证密码' }}
          </button>
        </view>
      </view>
    </view>
    
    <!-- 背景动画 -->
    <view class="background">
      <view class="circle circle-1"></view>
      <view class="circle circle-2"></view>
      <view class="circle circle-3"></view>
      <view class="line line-1"></view>
      <view class="line line-2"></view>
    </view>
  </view>
</template>

<script>
import LoadingSpin from '@/components/loading-spin.vue'
import request from '@/config/request.js'

export default {
  components: {
    LoadingSpin
  },
  data() {
    return {
      username: '',
      password: '',
      loading: false,
      // 配置相关
      showConfig: false,
      configPassword: '',
      isConfigAuthed: false,
      selectedWorkshop: '',
      currentWorkshop: ''
    }
  },
  
  onLoad() {
    // 页面加载时读取本地配置
    this.loadConfig()
  },
  
  methods: {
    // 加载本地配置
    loadConfig() {
      try {
        const workshop = uni.getStorageSync('workshop_config')
        if (workshop) {
          this.currentWorkshop = workshop
        }
      } catch (error) {
        console.error('读取配置失败:', error)
      }
    },
    
    // 显示配置弹窗
    showConfigDialog() {
      this.showConfig = true
      this.configPassword = ''
      this.isConfigAuthed = false
      this.selectedWorkshop = this.currentWorkshop || '2800车间'
    },
    
    // 隐藏配置弹窗
    hideConfigDialog() {
      this.showConfig = false
      this.configPassword = ''
      this.isConfigAuthed = false
    },
    
    // 选择车间
    selectWorkshop(workshop) {
      this.selectedWorkshop = workshop
    },
    
    // 保存配置
    saveConfig() {
      if (!this.isConfigAuthed) {
        // 验证管理员密码
        if (this.configPassword === 'wcs-admin') {
          this.isConfigAuthed = true
          uni.showToast({
            title: '密码验证成功',
            icon: 'success'
          })
        } else {
          uni.showToast({
            title: '密码错误',
            icon: 'error'
          })
        }
        return
      }
      
      // 保存配置到本地
      try {
        uni.setStorageSync('workshop_config', this.selectedWorkshop)
        this.currentWorkshop = this.selectedWorkshop
        this.hideConfigDialog()
        uni.showToast({
          title: '配置保存成功',
          icon: 'success'
        })
      } catch (error) {
        uni.showToast({
          title: '配置保存失败',
          icon: 'error'
        })
      }
    },
    
    async handleLogin() {
      if (!this.username || !this.password) {
        uni.showToast({
          title: '请输入用户名和密码',
          icon: 'none'
        })
        return
      }
      
      // 检查是否已配置车间
      if (!this.currentWorkshop) {
        uni.showModal({
          title: '提示',
          content: '请先配置车间信息\n长按标题可进入配置页面',
          showCancel: false,
          confirmText: '知道了'
        })
        return
      }
      
      this.loading = true
      try {
        // 调用真实的登录API
        const response = await request.post('/login/login', {
          userCode: this.username,
          userPassword: this.password
        })
        
        // 检查响应状态
        if (response.code === '200' && response.data) {
          const userData = response.data
          
          // 检查用户角色，只允许操作员登录移动端
          if (userData.userRole !== 'OPERATOR') {
            uni.showModal({
              title: '登录提示',
              content: '移动端仅支持操作员登录，请使用操作员账号',
              showCancel: false,
              confirmText: '知道了'
            })
            this.loading = false
            return
          }
          
          // 保存登录状态和车间配置
          uni.setStorageSync('token', userData.userId) // 使用userId作为token
          uni.setStorageSync('username', userData.userName)
          uni.setStorageSync('userCode', userData.userCode)
          uni.setStorageSync('current_workshop', this.currentWorkshop)
          
          uni.showToast({
            title: '登录成功',
            icon: 'success'
          })
          
          // 立即跳转到首页
          uni.reLaunch({
            url: '/pages/home/home'
          })
        } else {
          // 处理登录失败 - 直接显示后端返回的错误信息
          uni.showToast({
            title: response.message || '登录失败',
            icon: 'none',
            duration: 3000
          })
        }
      } catch (error) {
        console.error('登录失败:', error)
        uni.showToast({
          title: error.message || '登录失败，请检查网络',
          icon: 'none',
          duration: 3000
        })
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.login-container {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $bg-dark;
  
  .login-content {
    width: 80%;
    max-width: 600rpx;
    z-index: 2;
    
    .login-header {
      text-align: center;
      margin-bottom: 60rpx;
      
      .logo {
        width: 180rpx;
        height: 180rpx;
        margin-bottom: 30rpx;
      }
      
      .title {
        font-size: 40rpx;
        color: #fff;
        font-weight: bold;
        margin-bottom: 10rpx;
        user-select: none;
        cursor: pointer;
      }
      
      .subtitle {
        font-size: 24rpx;
        color: rgba(255,255,255,0.6);
        text-transform: uppercase;
        letter-spacing: 4rpx;
      }
    }
    
    .login-form {
      .input-item {
        background: rgba(255,255,255,0.1);
        border-radius: 45rpx;
        height: 90rpx;
        display: flex;
        align-items: center;
        padding: 0 40rpx;
        margin-bottom: 30rpx;
        backdrop-filter: blur(10px);
        transition: all $transition-fast;
        
        &:focus-within {
          background: rgba(255,255,255,0.15);
          transform: translateY(-2rpx);
          box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.1);
        }
        
        .iconfont {
          font-size: 36rpx;
          color: rgba(255,255,255,0.8);
          margin-right: 20rpx;
        }
        
        .input {
          flex: 1;
          height: 100%;
          color: #fff;
          font-size: 32rpx;
          
          &::placeholder {
            color: rgba(255,255,255,0.4);
          }
        }
      }
      
      .login-btn {
        width: 100%;
        height: 90rpx;
        border-radius: 45rpx;
        background: $primary-gradient;
        color: #fff;
        font-size: 32rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 60rpx;
        border: none;
        position: relative;
        overflow: hidden;
        
        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transform: translateX(-100%);
        }
        
        &:not(:disabled):active::before {
          transform: translateX(100%);
          transition: transform 0.6s ease;
        }
        
        &.loading {
          opacity: 0.8;
        }
        
        &:disabled {
          opacity: 0.6;
          pointer-events: none;
        }
      }
    }
    
    .login-footer {
      text-align: center;
      margin-top: 60rpx;
      
      .version {
        font-size: 24rpx;
        color: rgba(255,255,255,0.4);
        display: block;
        margin-bottom: 10rpx;
      }
      
      .workshop-info {
        font-size: 22rpx;
        color: rgba(255,255,255,0.6);
        display: block;
      }
    }
  }
  
  // 配置弹窗样式
  .config-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    
    .config-content {
      width: 80%;
      max-width: 500rpx;
      background: #fff;
      border-radius: 16rpx;
      overflow: hidden;
      
      .config-header {
        background: linear-gradient(90deg, #1a2a6c, #b21f1f);
        color: #fff;
        padding: 30rpx;
        display: flex;
        justify-content: space-between;
        align-items: center;
        
        .config-title {
          font-size: 36rpx;
          font-weight: bold;
        }
        
        .config-close {
          font-size: 40rpx;
          cursor: pointer;
        }
      }
      
      .config-form {
        padding: 40rpx 30rpx;
        
        .config-item {
          margin-bottom: 30rpx;
          
          .config-label {
            font-size: 28rpx;
            color: #333;
            margin-bottom: 15rpx;
            display: block;
          }
          
          .config-input {
            width: 100%;
            height: 80rpx;
            border: 2rpx solid #e0e0e0;
            border-radius: 8rpx;
            padding: 0 20rpx;
            font-size: 30rpx;
            color: #333;
            box-sizing: border-box;
            
            &:focus {
              border-color: #1a2a6c;
            }
          }
          
          .workshop-options {
            display: flex;
            gap: 20rpx;
            
            .workshop-option {
              flex: 1;
              height: 80rpx;
              border: 2rpx solid #e0e0e0;
              border-radius: 8rpx;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 28rpx;
              color: #666;
              cursor: pointer;
              
              &.active {
                border-color: #1a2a6c;
                background: #1a2a6c;
                color: #fff;
              }
            }
          }
        }
      }
      
              .config-actions {
          padding: 0 30rpx 30rpx;
          display: flex;
          justify-content: space-between;
          
          .config-btn {
            width: 45%;
            height: 80rpx;
            border-radius: 8rpx;
            font-size: 30rpx;
            border: none;
          
          &.cancel-btn {
            background: #f5f5f5;
            color: #666;
          }
          
          &.confirm-btn {
            background: linear-gradient(90deg, #1a2a6c, #b21f1f);
            color: #fff;
            
            &:disabled {
              opacity: 0.6;
              pointer-events: none;
            }
          }
        }
      }
    }
  }
  
  .background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
    
    .circle {
      position: absolute;
      border-radius: 50%;
      background: $primary-gradient;
      opacity: 0.1;
      
      &-1 {
        width: 600rpx;
        height: 600rpx;
        top: -200rpx;
        right: -200rpx;
      }
      
      &-2 {
        width: 400rpx;
        height: 400rpx;
        bottom: -100rpx;
        left: -100rpx;
      }
      
      &-3 {
        width: 300rpx;
        height: 300rpx;
        top: 40%;
        right: -100rpx;
        opacity: 0.05;
      }
    }
    
    .line {
      position: absolute;
      background: $secondary-gradient;
      opacity: 0.1;
      
      &-1 {
        width: 800rpx;
        height: 2rpx;
        top: 30%;
        left: -200rpx;
        transform: rotate(-45deg);
      }
      
      &-2 {
        width: 600rpx;
        height: 2rpx;
        bottom: 20%;
        right: -100rpx;
        transform: rotate(45deg);
      }
    }
  }
  
  .loading-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    
    .loading-content {
      background: rgba(0, 0, 0, 0.8);
      padding: 40rpx;
      border-radius: 16rpx;
      display: flex;
      flex-direction: column;
      align-items: center;
      
      .loading-icon {
        width: 60rpx;
        height: 60rpx;
        border: 4rpx solid rgba(255, 255, 255, 0.2);
        border-top: 4rpx solid #fff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 20rpx;
      }
      
      .loading-text {
        color: #fff;
        font-size: 28rpx;
      }
    }
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
}
</style> 