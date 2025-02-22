<template>
  <view class="workshop-one">
    <!-- 托盘缓存区 -->
    <view class="storage-section">
      <view class="section-title">托盘缓存区</view>
      <view class="pallet-grid">
        <view 
          v-for="(position, index) in palletPositions" 
          :key="index"
          class="position-item"
          :class="{ 'has-pallet': position.hasPallet }"
        >
          <view class="position-header">
            <text class="position-name">{{ position.name }}</text>
            <text class="position-status" :class="{ 'empty': !position.hasPallet }">
              {{ position.hasPallet ? '已占用' : '空闲' }}
            </text>
          </view>
          <view class="pallet-info" v-if="position.hasPallet">
            <text class="label">托盘码</text>
            <text class="value">{{ position.palletCode }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空托盘缓存区 -->
    <view class="storage-section">
      <view class="section-title">空托盘缓存区</view>
      <view class="empty-pallet-grid">
        <view 
          v-for="(position, index) in emptyPalletPositions" 
          :key="index"
          class="position-item"
          :class="{ 'has-pallet': position.hasPallet }"
        >
          <view class="position-header">
            <text class="position-name">{{ position.name }}</text>
            <text class="position-status" :class="{ 'empty': !position.hasPallet }">
              {{ position.hasPallet ? '已占用' : '空闲' }}
            </text>
          </view>
          <view class="pallet-info" v-if="position.hasPallet">
            <text class="label">托盘码</text>
            <text class="value">{{ position.palletCode }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'workshop-one',
  data() {
    return {
      palletPositions: [
        { name: 'P1', hasPallet: true, palletCode: 'P2023001' },
        { name: 'P2', hasPallet: false },
        { name: 'P3', hasPallet: true, palletCode: 'P2023002' },
        { name: 'P4', hasPallet: true, palletCode: 'P2023003' },
        { name: 'P5', hasPallet: false },
        { name: 'P6', hasPallet: true, palletCode: 'P2023004' },
        { name: 'P7', hasPallet: false },
        { name: 'P8', hasPallet: true, palletCode: 'P2023005' },
        { name: 'P9', hasPallet: false },
        { name: 'P10', hasPallet: true, palletCode: 'P2023006' },
      ],
      emptyPalletPositions: [
        { name: 'E1', hasPallet: true, palletCode: 'E2023001' },
        { name: 'E2', hasPallet: false },
        { name: 'E3', hasPallet: true, palletCode: 'E2023002' },
        { name: 'E4', hasPallet: false },
      ]
    }
  }
}
</script>

<style lang="scss" scoped>
.workshop-one {
  .storage-section {
    margin-bottom: 30rpx;
    
    .section-title {
      font-size: 32rpx;
      font-weight: bold;
      color: #333;
      margin-bottom: 20rpx;
      padding: 0 20rpx;
    }
    
    .pallet-grid, .empty-pallet-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20rpx;
      padding: 0 20rpx;
    }
    
    .position-item {
      background: #fff;
      border-radius: 12rpx;
      padding: 20rpx;
      box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.1);
      
      &.has-pallet {
        background: linear-gradient(135deg, #e6f7ff, #ffffff);
        border: 1px solid #91d5ff;
      }
      
      .position-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16rpx;
        
        .position-name {
          font-size: 28rpx;
          color: #333;
          font-weight: 500;
        }
        
        .position-status {
          font-size: 24rpx;
          color: #1890ff;
          background: rgba(24, 144, 255, 0.1);
          padding: 4rpx 12rpx;
          border-radius: 20rpx;
          
          &.empty {
            color: #999;
            background: #f5f5f5;
          }
        }
      }
      
      .pallet-info {
        display: flex;
        align-items: center;
        gap: 12rpx;
        
        .label {
          font-size: 24rpx;
          color: #666;
        }
        
        .value {
          font-size: 26rpx;
          color: #1890ff;
          font-weight: 500;
        }
      }
    }
  }
}
</style> 