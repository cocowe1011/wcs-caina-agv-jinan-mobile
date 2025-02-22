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
        <text class="title">移动WCS管理系统</text>
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

export default {
  components: {
    LoadingSpin
  },
  data() {
    return {
      username: '',
      password: '',
      loading: false
    }
  },
  methods: {
    async handleLogin() {
      if (!this.username || !this.password) {
        uni.showToast({
          title: '请输入用户名和密码',
          icon: 'none'
        })
        return
      }
      
      this.loading = true
      try {
        // 模拟登录请求
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // 保存登录状态
        uni.setStorageSync('token', 'demo_token')
        uni.setStorageSync('username', this.username)
        
        // 跳转到首页
        uni.reLaunch({
          url: '/pages/home/home'
        })
      } catch (error) {
        uni.showToast({
          title: '登录失败',
          icon: 'error'
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