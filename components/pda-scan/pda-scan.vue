<template>
  <view class="scan-modal-overlay" v-if="visible" @click="handleClose">
    <view class="scan-modal-content" @click.stop>
      <!-- 扫码区域 -->
      <view class="scan-area">
        <view class="scan-icon-wrapper">
          <text class="scan-icon">📷</text>
        </view>
        <view class="scan-title">请按击侧面扫码按钮进行扫描</view>
        <view class="scan-subtitle">等待扫码中...</view>
        
        <!-- 扫码结果展示 -->
        <view class="scan-result" v-if="scanCode">
          <text class="result-label">扫码结果：</text>
          <text class="result-value">{{ scanCode }}</text>
        </view>
      </view>
      
      <!-- 备用扫码方式 -->
      <view class="alternative-scan">
        <text class="alternative-text">扫描不到？</text>
        <text class="camera-scan-btn" @click="handleCameraScan">点击使用相机扫码</text>
      </view>
      
      <!-- 操作按钮 -->
      <view class="action-buttons">
        <view class="action-btn cancel-btn" @click="handleClose">取消</view>
        <view class="action-btn confirm-btn" :class="{'disabled': !scanCode}" @click="handleConfirm">确认</view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'pda-scan',
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      scanCode: '',
      main: null,
      receiver: null,
      filter: null,
      _codeQueryTag: false
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        this.scanCode = '';
        this.initScan();
        this.startScan();
      } else {
        this.stopScan();
      }
    }
  },
  beforeDestroy() {
    this.stopScan();
  },
  methods: {
    // 初始化海康PDA扫码
    initScan() {
      // #ifdef APP-PLUS
      try {
        this.main = plus.android.runtimeMainActivity(); // 获取activity
        let IntentFilter = plus.android.importClass('android.content.IntentFilter');
        this.filter = new IntentFilter();
        this.filter.addAction("com.service.scanner.data"); // 海康PDA广播动作
        
        const that = this;
        this.receiver = plus.android.implements('io.dcloud.feature.internal.reflect.BroadcastReceiver', {
          onReceive: function (context, intent) {
            plus.android.importClass(intent);
            let code = intent.getStringExtra("ScanCode"); // 海康PDA的广播标签
            console.log("海康PDA扫码结果:", code);
            that.queryCode(code);
          }
        });
        console.log("海康PDA扫码初始化成功");
      } catch (error) {
        console.error("海康PDA扫码初始化失败:", error);
      }
      // #endif
    },
    
    // 启动扫描监听
    startScan() {
      // #ifdef APP-PLUS
      if (this.main && this.receiver && this.filter) {
        try {
          this.main.registerReceiver(this.receiver, this.filter);
          console.log("海康PDA扫码监听已启动");
        } catch (error) {
          console.error("启动扫码监听失败:", error);
        }
      }
      // #endif
    },
    
    // 停止扫描监听
    stopScan() {
      // #ifdef APP-PLUS
      if (this.main && this.receiver) {
        try {
          this.main.unregisterReceiver(this.receiver);
          console.log("海康PDA扫码监听已停止");
        } catch (error) {
          console.error("停止扫码监听失败:", error);
        }
      }
      // #endif
    },
    
    // 处理扫码结果
    queryCode(code) {
      // 防重复
      if (this._codeQueryTag) return false;
      this._codeQueryTag = true;
      setTimeout(() => {
        this._codeQueryTag = false;
      }, 150);
      
      this.scanCode = code;
      
      // 震动反馈
      uni.vibrateLong({
        success: () => {
          console.log('震动反馈成功');
        }
      });
    },
    
    // 使用相机扫码（备用方案）
    handleCameraScan() {
      uni.scanCode({
        success: (res) => {
          console.log("相机扫码结果:", res.result);
          this.scanCode = res.result;
        },
        fail: (err) => {
          uni.showToast({
            title: '扫码失败',
            icon: 'none'
          });
          console.error("相机扫码失败:", err);
        }
      });
    },
    
    // 关闭弹窗
    handleClose() {
      this.scanCode = '';
      this.$emit('close');
    },
    
    // 确认扫码结果
    handleConfirm() {
      if (!this.scanCode) {
        uni.showToast({
          title: '请先扫码',
          icon: 'none'
        });
        return;
      }
      
      this.$emit('confirm', this.scanCode);
      this.scanCode = '';
    }
  }
}
</script>

<style lang="scss" scoped>
.scan-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.scan-modal-content {
  width: 85%;
  max-width: 600rpx;
  background: #ffffff;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 30rpx rgba(0, 0, 0, 0.15);
}

.scan-area {
  padding: 60rpx 40rpx 40rpx;
  text-align: center;
  background: linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%);
  
  .scan-icon-wrapper {
    margin-bottom: 24rpx;
    
    .scan-icon {
      font-size: 120rpx;
      display: block;
    }
  }
  
  .scan-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 16rpx;
  }
  
  .scan-subtitle {
    font-size: 26rpx;
    color: #6b7280;
    margin-bottom: 32rpx;
  }
  
  .scan-result {
    background: #f0f9ff;
    border: 1px solid #bfdbfe;
    border-radius: 12rpx;
    padding: 20rpx;
    margin-top: 24rpx;
    
    .result-label {
      font-size: 24rpx;
      color: #6b7280;
      display: block;
      margin-bottom: 8rpx;
    }
    
    .result-value {
      font-size: 28rpx;
      color: #1d4ed8;
      font-weight: 600;
      word-break: break-all;
      display: block;
    }
  }
}

.alternative-scan {
  padding: 24rpx 40rpx;
  text-align: center;
  background: #ffffff;
  border-top: 1px dashed #e5e7eb;
  
  .alternative-text {
    font-size: 24rpx;
    color: #9ca3af;
    margin-right: 8rpx;
  }
  
  .camera-scan-btn {
    font-size: 24rpx;
    color: #2563eb;
    text-decoration: underline;
    
    &:active {
      color: #1d4ed8;
    }
  }
}

.action-buttons {
  display: flex;
  padding: 24rpx 40rpx 40rpx;
  gap: 16rpx;
  background: #ffffff;
  
  .action-btn {
    flex: 1;
    text-align: center;
    padding: 24rpx 0;
    font-size: 30rpx;
    font-weight: 500;
    border-radius: 12rpx;
    transition: all 0.2s;
    
    &.cancel-btn {
      background: #f3f4f6;
      color: #4b5563;
      
      &:active {
        background: #e5e7eb;
      }
    }
    
    &.confirm-btn {
      background: #2563eb;
      color: #ffffff;
      
      &:active {
        background: #1d4ed8;
      }
      
      &.disabled {
        background: #93c5fd;
        color: #e0e7ff;
        opacity: 0.6;
      }
    }
  }
}
</style>

