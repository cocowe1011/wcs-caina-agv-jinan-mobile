<template>
  <view class="home-container">
    <!-- 状态栏占位 -->
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    
    <!-- 导航栏 -->
    <view class="header">
      <view class="welcome">欢迎回来，{{ username }}</view>
      <view class="logout" @tap="handleLogout">退出登录</view>
    </view>
    
    <!-- 可滚动的内容区域 -->
    <scroll-view 
      class="scroll-content"
      scroll-y
      :refresher-enabled="true"
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
      :style="{ opacity: pageReady ? 1 : 0 }"
    >
      <view class="content">
        
        <!-- 暂无数据提示 -->
        <view v-if="!currentOrder.id" class="empty-state">
          <text class="iconfont icon-empty"></text>
          <text class="empty-text">暂无队列数据</text>
        </view>
        
        <!-- 队列区域列表 -->
        <view v-else class="queue-areas">
          <view 
            class="queue-group" 
            v-for="group in queueGroups" 
            :key="group.title"
          >
            <view class="section-title">{{ group.title }}</view>
            <view class="area-grid">
              <view 
                class="area-item" 
                v-for="area in group.areas" 
                :key="area.id"
                @tap="navigateToQueue(area)"
              >
                <view class="area-content">
                  <text class="area-name">{{ area.name }}</text>
                  <text class="pallet-count">托盘数：{{ area.palletCount }}</text>
                </view>
                <view class="area-decoration">
                  <text class="area-id">{{ area.id }}</text>
                  <text class="iconfont icon-right"></text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import request from '@/config/request'

export default {
  components: {},
  data() {
    return {
      isRefreshing: false,
      username: '张工',
      currentOrder: {},
      queueGroups: [],
      statusBarHeight: 0,
      pageReady: false
    }
  },
  async onLoad() {
    // 获取状态栏高度
    const systemInfo = uni.getSystemInfoSync()
    this.statusBarHeight = systemInfo.statusBarHeight
    
    // 加载初始数据，不显示提示
    const hasOrder = await this.fetchOrderData(false)
    if (hasOrder) {
      await this.getQueueData()
    } else {
      this.queueGroups = []
    }
    // 显示页面
    this.pageReady = true
  },
  methods: {
    async getQueueData() {
      try {
        const res = await request.post('/queue_info/queryQueueList')
        if (res.code === '200' && Array.isArray(res.data)) {
          this.processQueueData(res.data)
        }
      } catch (error) {
        console.error('获取队列数据失败:', error)
      }
    },

    processQueueData(data) {
      // 定义区域分组
      const groups = {
        '上下货区域': ['上货区', '下货区-不解析', '下货区-立体库', '下货区-解析库', '小车一区', '小车二区', '小车三区'],
        '预热房区域1': ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'],
        '预热房区域2': ['A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'G2'],
        '灭菌区': ['A3', 'B3', 'C3', 'D3', 'E3', 'F3', 'G3']
      }

      // 初始化结果数组
      const result = []
      let globalIndex = 1

      // 处理每个分组
      for (const [groupTitle, areaNames] of Object.entries(groups)) {
        const areas = []
        
        // 查找每个区域名称对应的数据
        for (const areaName of areaNames) {
          const areaData = data.find(item => item.queueName === areaName)
          if (areaData) {
            // 解析托盘信息
            let trayInfo = []
            try {
              trayInfo = areaData.trayInfo ? JSON.parse(areaData.trayInfo) : []
            } catch (e) {
              console.error('解析托盘信息失败:', e)
            }

            areas.push({
              id: globalIndex++,
              name: areaData.queueName,
              palletCount: trayInfo.length,
              queueId: areaData.id  // 使用接口返回的原始id
            })
          }
        }

        // 只添加有区域的分组
        if (areas.length > 0) {
          result.push({
            title: groupTitle,
            areas: areas
          })
        }
      }

      this.queueGroups = result
    },
    handleLogout() {
      uni.clearStorageSync()
      uni.reLaunch({
        url: '/pages/login/login'
      })
    },
    
    // 获取订单数据
    async fetchOrderData(showToast = true) {
      try {
        const res = await request.post('/order_info/getNowRunningOrder')
        if (res.code === '200') {
          if (res.data) {
            this.currentOrder = { ...res.data }
            if (showToast) {
              uni.showToast({
                title: '刷新成功',
                icon: 'success'
              })
            }
            return true
          } else {
            this.currentOrder = {}
            if (showToast) {
              uni.showToast({
                title: '暂无运行订单数据',
                icon: 'none'
              })
            }
            return false
          }
        } else {
          if (showToast) {
            uni.showToast({
              title: res.message || '获取数据失败',
              icon: 'none'
            })
          }
          return false
        }
      } catch (error) {
        console.error('获取运行订单数据失败:', error)
        if (showToast) {
          uni.showToast({
            title: '网络异常',
            icon: 'error'
          })
        }
        return false
      }
    },
    
    // 下拉刷新
    async onRefresh() {
      this.isRefreshing = true
      const hasOrder = await this.fetchOrderData()
      if (hasOrder) {
        await this.getQueueData()
      } else {
        this.queueGroups = []
      }
      this.isRefreshing = false
    },
    
    navigateToQueue(area) {
      uni.showLoading({
        title: '加载中...',
        mask: true
      })
      
      uni.navigateTo({
        url: `/pages/queue/queue?queueId=${area.queueId}&name=${area.name}`,
        success: () => {
          uni.hideLoading()
        },
        fail: () => {
          uni.hideLoading()
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
    
    .welcome {
      font-size: 32rpx;
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
  }
  
  .content {
    padding: 30rpx;
    padding-bottom: env(safe-area-inset-bottom);  // 适配底部安全区域
    
    .section-title {
      font-size: 32rpx;
      color: #333;
      font-weight: bold;
      margin: 30rpx 0;
    }
    
    .area-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20rpx;
      
      .area-item {
        background: #fff;
        padding: 30rpx;
        border-radius: $border-radius;
        box-shadow: $card-shadow;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
        
        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 6rpx;
          height: 100%;
          background: linear-gradient(to bottom, #1a2a6c, #b21f1f);
          opacity: 0.8;
        }
        
        &:active {
          transform: scale(0.98);
          box-shadow: $hover-shadow;
        }
        
        .area-content {
          flex: 1;
          margin-left: 20rpx;
          
          .area-name {
            font-size: 32rpx;
            color: $text-primary;
            font-weight: bold;
            margin-bottom: 8rpx;
            display: block;
          }
          
          .pallet-count {
            font-size: 26rpx;
            color: $text-secondary;
            display: flex;
            align-items: center;
            
            &::before {
              content: '';
              width: 6rpx;
              height: 6rpx;
              background: #1a2a6c;
              border-radius: 50%;
              margin-right: 8rpx;
            }
          }
        }
        
        .area-decoration {
          text-align: right;
          
          .area-id {
            font-size: 40rpx;
            font-weight: bold;
            color: rgba(26, 42, 108, 0.1);
            display: block;
          }
          
          .iconfont {
            font-size: 32rpx;
            color: $text-secondary;
            margin-top: 8rpx;
          }
        }
      }
    }
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100rpx 0;
    
    .iconfont {
      font-size: 120rpx;
      color: #ccc;
      margin-bottom: 20rpx;
    }
    
    .empty-text {
      font-size: 32rpx;
      color: #999;
    }
  }
}
</style> 