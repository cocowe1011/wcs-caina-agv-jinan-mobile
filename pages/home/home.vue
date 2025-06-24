<template>
  <view class="home-container">
    <!-- 状态栏占位 -->
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    
    <!-- 导航栏 -->
    <view class="header">
      <view class="left-section">
        <text class="welcome">欢迎回来，{{ username }}</text>
        <view class="workshop-info">
          <text class="iconfont icon-location"></text>
          <text class="current-workshop">{{ currentWorkshopName }}</text>
        </view>
      </view>
      <view class="logout" @tap="handleLogout">退出登录</view>
    </view>
    
    <!-- 可滚动的内容区域 -->
    <scroll-view 
      class="scroll-content"
      scroll-y
      :style="{ opacity: pageReady ? 1 : 0 }"
    >
      <!-- 添加一个顶部内边距容器 -->
      <view class="content-wrapper">
        <!-- 一号车间的组件 -->
        <view v-if="currentWorkshop === 1">
          <workshop-one></workshop-one>
        </view>

        <!-- 二号车间的组件 -->
        <view v-if="currentWorkshop === 2">
          <workshop-two></workshop-two>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import WorkshopOne from '@/components/workshop-one/workshop-one.vue'
import WorkshopTwo from '@/components/workshop-two/workshop-two.vue'

export default {
  components: {
    WorkshopOne,
    WorkshopTwo
  },
  data() {
    return {
      username: '用户',
      statusBarHeight: 0,
      pageReady: false,
      currentWorkshop: 1, // 默认显示2800车间
      currentWorkshopName: '2800车间'
    }
  },
  
  async onLoad() {
    // 获取状态栏高度
    const systemInfo = uni.getSystemInfoSync()
    this.statusBarHeight = systemInfo.statusBarHeight
    
    // 从登录时保存的用户信息中读取用户名
    try {
      const savedUsername = uni.getStorageSync('username')
      if (savedUsername) {
        this.username = savedUsername
      }
    } catch (error) {
      console.error('读取用户信息失败:', error)
    }
    
    // 从登录时保存的配置中读取当前车间
    try {
      const savedWorkshop = uni.getStorageSync('current_workshop')
      if (savedWorkshop) {
        this.currentWorkshopName = savedWorkshop
        // 根据车间名称设置索引
        if (savedWorkshop === '2800车间') {
          this.currentWorkshop = 1
        } else if (savedWorkshop === '2500车间') {
          this.currentWorkshop = 2
        }
      }
    } catch (error) {
      console.error('读取车间配置失败:', error)
    }
    
    this.pageReady = true
  },
  
  methods: {
    handleLogout() {
      uni.showModal({
        title: '确认退出',
        content: '确定要退出登录吗？',
        confirmText: '确认退出',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 只清除登录相关的存储，保留车间配置
            uni.removeStorageSync('token')
            uni.removeStorageSync('username')
            uni.removeStorageSync('current_workshop')
            // 注意：不清除 workshop_config，保留车间配置
            
            uni.reLaunch({
              url: '/pages/login/login'
            })
          }
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.home-container {
  min-height: 100vh;
  background: #f5f7fa;
  
  .status-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(90deg, #1a2a6c, #b21f1f);
    z-index: 101;
  }
  
  .header {
    position: fixed;
    top: var(--status-bar-height);
    left: 0;
    right: 0;
    background: linear-gradient(90deg, #1a2a6c, #b21f1f);
    padding: 20rpx 30rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #fff;
    z-index: 100;
    
    .left-section {
      display: flex;
      align-items: center;
      
      .welcome {
        font-size: 32rpx;
        line-height: 1;
      }
      
      .workshop-info {
        font-size: 26rpx;
        display: inline-flex;
        align-items: center;
        background: rgba(255, 255, 255, 0.1);
        padding: 4rpx 16rpx;
        border-radius: 30rpx;
        border: 1px solid rgba(255, 255, 255, 0.2);
        line-height: 48rpx;
        height: 48rpx;
        margin-left: 10rpx;
        
        .icon-location {
          font-size: 24rpx;
          margin-right: 6rpx;
        }
        
        .current-workshop {
          margin: 0 6rpx;
          font-weight: 500;
        }
      }
    }
    
    .logout {
      font-size: 28rpx;
      padding: 10rpx 20rpx;
      border: 1px solid rgba(255,255,255,0.5);
      border-radius: 30rpx;
    }
  }

  .scroll-content {
    position: fixed;
    top: calc(var(--status-bar-height) + 88rpx);
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
    transition: opacity 0.3s ease;

    // 添加内容包装器样式
    .content-wrapper {
      padding: 20rpx 0;
    }
  }

  .component-container {
    padding: 20rpx;

    .component-box {
      background: #fff;
      margin-bottom: 20rpx;
      padding: 30rpx;
      border-radius: 12rpx;
      box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.1);
      min-height: 200rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28rpx;
      color: #999;
    }
  }
}
</style> 