<template>
  <view class="workshop-two">
    <view class="developing-container">
      <image class="developing-icon" src="/static/images/developing.png" mode="aspectFit"></image>
      <text class="developing-text">功能正在开发中...</text>
      <text class="developing-subtext">敬请期待</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'workshop-two'
}
</script>

<style lang="scss" scoped>
.workshop-two {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  
  .developing-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    
    .developing-icon {
      width: 200rpx;
      height: 200rpx;
      margin-bottom: 30rpx;
    }
    
    .developing-text {
      font-size: 36rpx;
      font-weight: bold;
      color: #333;
      margin-bottom: 16rpx;
    }
    
    .developing-subtext {
      font-size: 28rpx;
      color: #999;
    }
  }
}
</style> 