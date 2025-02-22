<template>
  <view class="loading-spin" :style="{ fontSize: size + 'rpx' }">
    <text class="iconfont icon-loading"></text>
  </view>
</template>

<script>
export default {
  name: 'LoadingSpin',
  props: {
    size: {
      type: [Number, String],
      default: 32
    }
  }
}
</script>

<style lang="scss" scoped>
.loading-spin {
  display: inline-block;
  
  .iconfont {
    display: inline-block;
    animation: loading-rotate 1s linear infinite;
  }
}

@keyframes loading-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style> 