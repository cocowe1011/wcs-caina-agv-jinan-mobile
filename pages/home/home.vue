<template>
  <view class="home-container">
    <!-- 状态栏占位 -->
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    
    <!-- 导航栏 -->
    <view class="header">
      <view class="left-section">
        <text class="welcome">欢迎回来，{{ username }}</text>
        <view class="workshop-selector" @tap="showWorkshopPicker">
          <text class="iconfont icon-location"></text>
          <text class="current-workshop">{{ workshops[currentWorkshop-1] }}</text>
          <text class="iconfont icon-arrow-down"></text>
          <text class="hint-text">切换</text>
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
          <view class="component-container">
            <view class="component-box">组件一</view>
            <view class="component-box">组件二</view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import WorkshopOne from '@/components/workshop-one/workshop-one.vue'

export default {
  components: {
    WorkshopOne
  },
  data() {
    return {
      username: '张工',
      statusBarHeight: 0,
      pageReady: false,
      currentWorkshop: 1, // 默认显示一号车间
      workshops: ['一号车间', '二号车间']
    }
  },
  
  async onLoad() {
    // 获取状态栏高度
    const systemInfo = uni.getSystemInfoSync()
    this.statusBarHeight = systemInfo.statusBarHeight
    this.pageReady = true
  },
  
  methods: {
    handleLogout() {
      uni.clearStorageSync()
      uni.reLaunch({
        url: '/pages/login/login'
      })
    },
    
    showWorkshopPicker() {
      uni.showActionSheet({
        itemList: this.workshops,
        success: (res) => {
          this.currentWorkshop = res.tapIndex + 1
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
      gap: 20rpx;
      
      .welcome {
        font-size: 32rpx;
      }
      
      .workshop-selector {
        font-size: 26rpx;
        display: inline-flex;
        align-items: center;
        background: rgba(255, 255, 255, 0.1);
        padding: 4rpx 16rpx;
        border-radius: 30rpx;
        border: 1px solid rgba(255, 255, 255, 0.2);
        
        .icon-location {
          font-size: 24rpx;
          margin-right: 6rpx;
        }
        
        .current-workshop {
          margin: 0 6rpx;
          font-weight: 500;
        }
        
        .icon-arrow-down {
          font-size: 24rpx;
          transition: transform 0.3s;
        }
        
        .hint-text {
          font-size: 22rpx;
          opacity: 0.8;
          margin-left: 6rpx;
          position: relative;
          
          &::before {
            content: '|';
            margin-right: 8rpx;
            opacity: 0.3;
          }
        }
        
        &:active {
          background: rgba(255, 255, 255, 0.15);
          
          .icon-arrow-down {
            transform: rotate(180deg);
          }
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