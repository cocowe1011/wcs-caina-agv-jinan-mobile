<template>
  <view class="workshop-one">
    <!-- 选项卡 -->
    <view class="tabs-container">
      <view 
        v-for="(tab, index) in tabs" 
        :key="index"
        class="tab-item"
        :class="{ 'active': currentTab === index }"
        @click="switchTab(index)"
      >
        {{ tab.name }}
      </view>
    </view>

    <!-- 队列内容 -->
    <view class="content-section">
      <view class="queue-header">
        <text class="queue-title">{{ tabs[currentTab].name }}</text>
        <view class="header-right">
          <text class="queue-count">共 {{ currentQueueData.length }} 个托盘</text>
          <view class="refresh-btn" @click="fetchQueueData">
            <text class="refresh-text" :class="{'refreshing': loading}">刷新</text>
          </view>
        </view>
      </view>
      
      <!-- 加载指示器 -->
      <view class="loading-container" v-if="loading">
        <view class="loading-spinner"></view>
        <text class="loading-text">加载中...</text>
      </view>
      
      <view class="pallet-list">
        <view 
          v-for="(item, index) in currentQueueData" 
          :key="index"
          class="pallet-card"
        >
          <view class="card-header">
            <view class="position-badge">{{ item.queueName + item.queueNum }}</view>
            <view class="header-right">
              <view class="status-tag" :class="getStatusClass(item.trayStatus)">
                {{ getStatusText(item.trayStatus) }}
              </view>
              <view v-if="item.trayInfo" class="verify-tray-btn" @click="verifyTrayCode(item)">
                校验
              </view>
              <view v-if="item.trayInfo" class="move-tray-btn" @click="showMovePalletModal(item)">
                移位
              </view>
              <view v-if="item.trayInfo" class="remove-tray-btn" @click="showRemoveTrayConfirm(item)">
                移除
              </view>
            </view>
          </view>
          
          <view class="card-content">
            <view class="left-section">
              <view class="info-item">
                <text class="info-label">托盘码</text>
                <text class="info-value" v-if="item.trayInfo">{{ item.trayInfo }}</text>
                <view class="scan-add-btn" v-else @click="scanToAddWasteTray(item)">
                  <text class="scan-btn-text">扫码添加废料托盘</text>
                </view>
              </view>
              <view class="info-item">
                <text class="info-label">产品名称</text>
                <text class="info-value product-name">{{ item.trayInfoAdd }}</text>
              </view>
            </view>
            
            <view class="right-section">
              <!-- trayStatus为2时，显示发送图标 -->
              <view class="send-button" v-if="item.trayStatus === '2' && !item.showDestinationInput" @click="showDestinationInput(index)">
                发送
              </view>
              
              <!-- 显示目的地输入框和发送按钮 -->
              <view class="destination-input-container" v-if="item.showDestinationInput">
                <input 
                  class="destination-input" 
                  type="text" 
                  placeholder="目的地" 
                  v-model="item.destination"
                />
                <view class="buttons-row">
                  <view class="cancel-btn" @click="cancelSend(item)">取消</view>
                  <view class="send-btn" @click="sendTray(item)">确认</view>
                </view>
              </view>
              
              <!-- trayStatus为3、4、5时，显示发送状态和目的地 -->
              <view class="sending-status" v-if="['3', '4', '5'].includes(item.trayStatus)">
                <view class="status-label">状态：<text class="status-value">正在发送中</text></view>
                <view class="destination-label">目的地：<text class="destination-value">{{ item.targetPosition || '未知' }}</text></view>
              </view>
            </view>
          </view>
        </view>
      </view>
      
      <!-- 无数据提示 -->
      <view class="empty-state" v-if="currentQueueData.length === 0">
        <text class="empty-text">暂无托盘数据</text>
      </view>
    </view>
    
    <!-- 托盘移位弹窗 -->
    <view class="modal-overlay" v-if="showMoveModal" @click="cancelMove">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">选择移位目标位置</text>
          <text class="modal-close" @click="cancelMove">×</text>
        </view>
        <view class="modal-body">
          <view class="position-list">
            <view 
              v-for="(pos, idx) in availablePositions" 
              :key="idx" 
              class="position-item"
              :class="{'selected': selectedPosition === pos.position}"
              @click="selectPosition(pos.position)"
            >
              <view class="position-name">{{ pos.position }}</view>
              <view class="position-status">
                <text v-if="pos.hasTray" class="has-tray">已有托盘 (互换)</text>
                <text v-else class="no-tray">空位置</text>
              </view>
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <view class="modal-btn cancel" @click="cancelMove">取消</view>
          <view class="modal-btn confirm" @click="confirmMove" :class="{'disabled': !selectedPosition}">确认移位</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import request from '@/config/request.js'
import requestAgv from '@/config/requestAgv.js'

export default {
  name: 'workshop-one',
  data() {
    return {
      currentTab: 0,
      tabs: [
        { name: '一楼货物缓存库位', code: 'C' },
        { name: '三楼货物缓存库位', code: 'B' },
        { name: '拆垛间缓存库位', code: 'A' }
      ],
      queueData: {
        'A': [],
        'B': [],
        'C': []
      },
      loading: false,
      // 新增托盘移位相关数据
      showMoveModal: false,
      currentPallet: null,
      selectedPosition: '',
      availablePositions: []
    }
  },
  computed: {
    currentQueueData() {
      const code = this.tabs[this.currentTab].code;
      return this.queueData[code] || [];
    }
  },
  created() {
    this.fetchQueueData();
  },
  methods: {
    switchTab(index) {
      if (this.currentTab !== index) {
        this.currentTab = index;
        this.fetchQueueData();
      }
    },
    fetchQueueData() {
      const queueName = this.tabs[this.currentTab].code;
      this.loading = true;
      
      request.post('/queue_info/queryQueueList', {
        queueName: queueName,
      }).then(res => {
        if (res.code === '200' && Array.isArray(res.data)) {
          this.queueData[queueName] = res.data
        } else {
          this.queueData[queueName] = [];
          uni.showToast({
            title: '获取数据失败',
            icon: 'none'
          });
        }
      }).catch(err => {
        uni.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
        console.error('请求失败:', err);
      }).finally(() => {
        this.loading = false;
      });
    },
    getStatusText(status) {
      switch(status) {
        case '0':
          return '在2800等待AGV取货';
        case '1':
          return '已在2800取货，正往缓存区运送';
        case '2':
          return '已送至二楼缓存区';
        case '3':
          return '在缓存区等待AGV取货';
        case '4':
          return '已在缓存区取货，正往运往目的地';
        default:
          return '暂无托盘';
      }
    },
    getStatusClass(status) {
      switch(status) {
        case '0':
          return 'status-waiting';
        case '1':
          return 'status-moving';
        case '2':
          return 'status-delivered';
        case '3':
          return 'status-waiting';
        case '4':
          return 'status-moving';
        default:
          return '';
      }
    },
    // 显示目的地输入框
    showDestinationInput(index) {
      const code = this.tabs[this.currentTab].code;
      const item = this.queueData[code][index];
      
      // 使用Vue.set添加响应式属性
      this.$set(item, 'showDestinationInput', true);
      this.$set(item, 'destination', '');
    },
    
    // 发送托盘
    sendTray(item) {
      if (!item.destination) {
        uni.showToast({
          title: '请输入目的地',
          icon: 'none'
        });
        return;
      }
      
      // 添加确认对话框
      uni.showModal({
        title: '确认发送',
        content: `确定要将托盘发送到 ${item.destination} 吗？`,
        success: (res) => {
          if (res.confirm) {
            // 用户点击确定，执行发送操作
            this.executeAgvSend(item);
          } else {
            // 用户点击取消，不执行任何操作
            console.log('用户取消发送');
          }
        }
      });
    },
    
    // 执行AGV发送操作
    executeAgvSend(item) {
      // 显示加载状态
      this.loading = true;
      this.$set(item, 'showDestinationInput', false);
      
      // 调用发送AGV指令方法，确定任务类型和起点终点
      const taskType = 'PF-FMR-COMMON-JH2'; // 假设是从缓存区到输送线
      const fromSiteCode = item.queueName + item.queueNum;
      
      this.sendAgvCommand(taskType, fromSiteCode, '201')
        .then(robotTaskCode => {
          if (robotTaskCode) {
            // 更新托盘状态为正在发送中
            const param = {
              id: item.id,
              trayStatus: '3', // 在缓存区等待AGV取货
              robotTaskCode,
              targetPosition: item.destination // 保存目的地信息
            };
            
            request.post('/queue_info/update', param)
              .then(res => {
                if (res.code === '200' && res.data == 1) {
                  uni.showToast({
                    title: `托盘已发送至 ${item.destination}`,
                    icon: 'success'
                  });
                  
                  // 更新本地item的状态
                  this.$set(item, 'trayStatus', '3');
                  this.$set(item, 'targetPosition', item.destination);
                  
                  // 重新加载当前区域数据
                  this.fetchQueueData();
                } else {
                  uni.showToast({
                    title: '托盘状态更新失败',
                    icon: 'none'
                  });
                }
              })
              .catch(err => {
                uni.showToast({
                  title: '托盘状态更新失败',
                  icon: 'none'
                });
              })
              .finally(() => {
                this.loading = false;
              });
          } else {
            uni.showToast({
              title: 'AGV指令发送失败',
              icon: 'none'
            });
            this.loading = false;
          }
        })
        .catch(err => {
          uni.showToast({
            title: '发送指令失败',
            icon: 'none'
          });
          this.loading = false;
        });
    },
    
    // 发送AGV指令
    async sendAgvCommand(taskType, fromSiteCode, toSiteCode) {
      // 组装入参
      // return Date.now().toString();
      const params = {
        taskType: taskType,
        targetRoute: [
          {
            type: 'SITE',
            code: fromSiteCode
          },
          {
            type: 'SITE',
            code: toSiteCode
          }
        ]
      };
      
      try {
        // 发送AGV指令
        const res = await requestAgv.post('/rcs/rtas/api/robot/controller/task/submit', params);
        
        if (res.code === 'SUCCESS') {
          // 成功时返回robotTaskCode
          // 提示成功
          uni.showToast({
            title: 'AGV指令发送成功',
            icon: 'success'
          });
          return res.data.robotTaskCode;
        } else {
          // 处理各种错误类型
          let errorMsg = '';
          switch (res.errorCode) {
            case 'Err_TaskTypeNotSupport':
              errorMsg = '任务类型不支持';
              break;
            case 'Err_RobotGroupsNotMatch':
              errorMsg = '机器人资源组编号与任务不匹配，无法调度';
              break;
            case 'Err_RobotCodeNotMatch':
              errorMsg = '机器人编号与任务不匹配，无法调度';
              break;
            case 'Err_TargetRouteError':
              errorMsg = '任务路径参数有误';
              break;
            default:
              errorMsg = res.message || '未知错误';
          }
          
          uni.showToast({
            title: errorMsg,
            icon: 'none'
          });
          
          return '';
        }
      } catch (err) {
        console.error('发送AGV指令失败:', err);
        return '';
      }
    },
    
    // 取消发送
    cancelSend(item) {
      this.$set(item, 'showDestinationInput', false);
      this.$set(item, 'destination', '');
    },
    
    // 扫码添加废料托盘功能
    scanToAddWasteTray(item) {
      // 调用扫码API
      uni.scanCode({
        success: (res) => {
          // 扫码成功后，将扫码结果作为trayInfo传递
          this.updateToWasteTray(item, res.result);
        },
        fail: (err) => {
          uni.showToast({
            title: '扫码失败',
            icon: 'none'
          });
        }
      });
    },
    
    // 更新为废料托盘
    updateToWasteTray(item, scanResult) {
      this.loading = true;
      
      const param = {
        id: item.id,
        trayInfo: scanResult, // 使用扫码得到的条码作为trayInfo
        trayStatus: '2',
        trayInfoAdd: '废料托盘'
      };
      
      request.post('/queue_info/update', param)
        .then(res => {
          if (res.code === '200' && res.data == 1) {
            uni.showToast({
              title: '废料托盘添加成功',
              icon: 'success'
            });
            
            // 更新本地数据
            this.$set(item, 'trayInfo', scanResult); // 使用扫码结果
            this.$set(item, 'trayStatus', '2');
            this.$set(item, 'trayInfoAdd', '废料托盘');
            
            // 重新加载当前区域数据
            this.fetchQueueData();
          } else {
            uni.showToast({
              title: '废料托盘添加失败',
              icon: 'none'
            });
          }
        })
        .catch(err => {
          uni.showToast({
            title: '网络请求失败',
            icon: 'none'
          });
          console.error('更新失败:', err);
        })
        .finally(() => {
          this.loading = false;
        });
    },
    
    // 显示移位模态框
    showMovePalletModal(item) {
      this.currentPallet = item;
      this.selectedPosition = '';
      this.showMoveModal = true;
      
      // 准备可用位置列表
      this.prepareAvailablePositions();
    },
    
    // 准备可用位置列表
    prepareAvailablePositions() {
      const currentCode = this.tabs[this.currentTab].code;
      const positions = [];
      
      // 将当前区域的所有位置加入列表
      this.queueData[currentCode].forEach(item => {
        // 排除当前托盘自己的位置
        if (this.currentPallet && (item.queueName + item.queueNum) === (this.currentPallet.queueName + this.currentPallet.queueNum)) {
          return;
        }
        
        positions.push({
          position: item.queueName + item.queueNum,
          hasTray: !!item.trayInfo,
          item: item
        });
      });
      
      this.availablePositions = positions;
    },
    
    // 选择目标位置
    selectPosition(position) {
      this.selectedPosition = position;
    },
    
    // 取消移位
    cancelMove() {
      this.showMoveModal = false;
      this.currentPallet = null;
      this.selectedPosition = '';
      this.availablePositions = [];
    },
    
    // 确认移位
    confirmMove() {
      if (!this.selectedPosition) {
        uni.showToast({
          title: '请选择目标位置',
          icon: 'none'
        });
        return;
      }
      
      // 确认对话框
      uni.showModal({
        title: '确认移位',
        content: `确定要将托盘从 ${this.currentPallet.queueName + this.currentPallet.queueNum} 移至 ${this.selectedPosition} 吗？`,
        success: (res) => {
          if (res.confirm) {
            this.executePalletMove();
          }
        }
      });
    },
    
    // 执行托盘移位
    executePalletMove() {
      this.loading = true;
      
      // 找到目标位置对应的托盘数据
      const targetPosition = this.availablePositions.find(pos => pos.position === this.selectedPosition);
      
      if (!targetPosition) {
        uni.showToast({
          title: '目标位置不存在',
          icon: 'none'
        });
        this.loading = false;
        return;
      }
      
      // 准备更新数据
      const updateList = [];
      
      // 当前托盘数据
      const sourcePallet = { ...this.currentPallet };
      // 目标位置托盘数据
      const targetPallet = targetPosition.item ? { ...targetPosition.item } : null;
      
      // 如果目标位置没有托盘信息，直接移动
      if (!targetPallet.trayInfo) {
        // 目标位置获取源托盘信息
        updateList.push({
          id: targetPallet.id,
          trayInfo: sourcePallet.trayInfo,
          trayStatus: sourcePallet.trayStatus,
          trayInfoAdd: sourcePallet.trayInfoAdd,
          robotTaskCode: sourcePallet.robotTaskCode,
          targetPosition: sourcePallet.targetPosition
        });
        
        // 源托盘位置清空信息
        updateList.push({
          id: sourcePallet.id,
          trayInfo: '',
          trayStatus: '',
          trayInfoAdd: '',
          robotTaskCode: '',
          targetPosition: ''
        });
      } else {
        // 如果目标位置有托盘，则交换五个指定参数
        
        // 目标位置托盘获取源托盘信息
        updateList.push({
          id: targetPallet.id,
          trayInfo: sourcePallet.trayInfo,
          trayStatus: sourcePallet.trayStatus,
          trayInfoAdd: sourcePallet.trayInfoAdd,
          robotTaskCode: sourcePallet.robotTaskCode,
          targetPosition: sourcePallet.targetPosition
        });
        
        // 源位置托盘获取目标托盘信息
        updateList.push({
          id: sourcePallet.id,
          trayInfo: targetPallet.trayInfo,
          trayStatus: targetPallet.trayStatus,
          trayInfoAdd: targetPallet.trayInfoAdd,
          robotTaskCode: targetPallet.robotTaskCode,
          targetPosition: targetPallet.targetPosition
        });
      }
      
      // 调用批量更新API
      request.post('/queue_info/updateByList', updateList)
        .then(res => {
          if (res.code === '200' && res.data == 1) {
            uni.showToast({
              title: '托盘移位成功',
              icon: 'success'
            });
            
            // 重新加载数据
            this.fetchQueueData();
          } else {
            uni.showToast({
              title: '托盘移位失败: ' + (res.msg || '未知错误'),
              icon: 'none'
            });
          }
        })
        .catch(err => {
          uni.showToast({
            title: '托盘移位请求失败',
            icon: 'none'
          });
          console.error('移位失败:', err);
        })
        .finally(() => {
          this.loading = false;
          this.cancelMove();
        });
    },
    
    // 显示移除托盘确认对话框
    showRemoveTrayConfirm(item) {
      uni.showModal({
        title: '确认移除',
        content: `确定要移除托盘 ${item.trayInfo} 吗？`,
        success: (res) => {
          if (res.confirm) {
            this.removeTray(item);
          }
        }
      });
    },
    
    // 移除托盘信息
    removeTray(item) {
      this.loading = true;
      
      const param = {
        id: item.id,
        trayInfo: '',
        trayStatus: '',
        trayInfoAdd: '',
        robotTaskCode: '',
        targetPosition: ''
      };
      
      request.post('/queue_info/update', param)
        .then(res => {
          if (res.code === '200' && res.data == 1) {
            uni.showToast({
              title: '托盘信息已移除',
              icon: 'success'
            });
            
            // 重新加载当前区域数据
            this.fetchQueueData();
          } else {
            uni.showToast({
              title: '托盘信息移除失败',
              icon: 'none'
            });
          }
        })
        .catch(err => {
          uni.showToast({
            title: '网络请求失败',
            icon: 'none'
          });
          console.error('移除失败:', err);
        })
        .finally(() => {
          this.loading = false;
        });
    },
    
    // 校验托盘条码
    verifyTrayCode(item) {
      // 调用扫码API
      uni.scanCode({
        success: (res) => {
          // 扫码成功后，将扫码结果作为trayInfo传递
          this.updateTrayCode(item, res.result);
        },
        fail: (err) => {
          uni.showToast({
            title: '扫码失败',
            icon: 'none'
          });
        }
      });
    },
    
    // 更新托盘条码
    updateTrayCode(item, newTrayCode) {
      this.loading = true;
      
      const param = {
        id: item.id,
        trayInfo: newTrayCode
      };
      
      request.post('/queue_info/update', param)
        .then(res => {
          if (res.code === '200' && res.data == 1) {
            uni.showToast({
              title: '托盘条码更新成功',
              icon: 'success'
            });
            
            // 更新本地数据
            this.$set(item, 'trayInfo', newTrayCode);
            
            // 重新加载当前区域数据
            this.fetchQueueData();
          } else {
            uni.showToast({
              title: '托盘条码更新失败',
              icon: 'none'
            });
          }
        })
        .catch(err => {
          uni.showToast({
            title: '网络请求失败',
            icon: 'none'
          });
          console.error('更新失败:', err);
        })
        .finally(() => {
          this.loading = false;
        });
    }
  }
}
</script>

<style lang="scss" scoped>
.workshop-one {
  min-height: 100vh;
  background-color: #e6e9f0;
  padding: 32rpx 24rpx;
  
  // 选项卡样式
  .tabs-container {
    display: flex;
    background: #fff;
    border-radius: 12rpx;
    overflow: hidden;
    box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
    margin-bottom: 32rpx;
    
    .tab-item {
      flex: 1;
      text-align: center;
      padding: 28rpx 0;
      font-size: 28rpx;
      color: #666;
      position: relative;
      transition: all 0.2s ease;
      
      &.active {
        color: #2563eb;
        font-weight: 500;
        background: rgba(37, 99, 235, 0.03);
        
        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 4rpx;
          background: #2563eb;
        }
      }
      
      &:active {
        background: rgba(0, 0, 0, 0.02);
      }
    }
  }
  
  // 内容区域
  .content-section {
    .queue-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24rpx;
      padding: 0 8rpx;
      
      .queue-title {
        font-size: 32rpx;
        font-weight: 600;
        color: #1f2937;
      }
      
      .header-right {
        display: flex;
        align-items: center;
      }
      
      .queue-count {
        font-size: 24rpx;
        color: #6b7280;
        background: rgba(107, 114, 128, 0.08);
        padding: 6rpx 16rpx;
        border-radius: 20rpx;
        margin-right: 16rpx;
      }
      
      .refresh-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #2563eb;
        border-radius: 8rpx;
        padding: 6rpx 16rpx;
        margin-left: 16rpx;
        
        .refresh-text {
          font-size: 24rpx;
          color: #ffffff;
          
          &.refreshing {
            opacity: 0.7;
          }
        }
        
        &:active {
          background-color: #1d4ed8;
        }
      }
    }
    
    // 加载状态
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40rpx 0;
      
      .loading-spinner {
        width: 60rpx;
        height: 60rpx;
        border: 4rpx solid rgba(37, 99, 235, 0.2);
        border-top: 4rpx solid #2563eb;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 16rpx;
      }
      
      .loading-text {
        font-size: 28rpx;
        color: #6b7280;
      }
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    // 托盘列表
    .pallet-list {
      display: flex;
      flex-direction: column;
    }
    
    // 托盘卡片
    .pallet-card {
      background: #ffffff;
      border-radius: 16rpx;
      overflow: hidden;
      box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.12);
      margin-bottom: 30rpx;
      
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20rpx 24rpx;
        background: #f9fafb;
        border-bottom: 1px solid #f3f4f6;
        
        .position-badge {
          background: #2563eb;
          color: #fff;
          font-size: 26rpx;
          font-weight: 500;
          padding: 6rpx 16rpx;
          border-radius: 8rpx;
        }
        
        .header-right {
          display: flex;
          align-items: center;
          gap: 12rpx;
        }
        
        .status-tag {
          font-size: 24rpx;
          padding: 6rpx 16rpx;
          border-radius: 6rpx;
          font-weight: 500;
          
          &.status-delivered {
            color: #059669;
            background: #ecfdf5;
          }
          
          &.status-waiting {
            color: #d97706;
            background: #fffbeb;
          }
          
          &.status-moving {
            color: #2563eb;
            background: #eff6ff;
          }
        }
        
        .verify-tray-btn {
          background: #10b981;
          color: #fff;
          padding: 6rpx 16rpx;
          border-radius: 6rpx;
          font-size: 24rpx;
          font-weight: 500;
          margin-left: 8rpx;
          
          &:active {
            background: #059669;
          }
        }
        
        .move-tray-btn {
          background: #8b5cf6;
          color: #fff;
          padding: 6rpx 16rpx;
          border-radius: 6rpx;
          font-size: 24rpx;
          font-weight: 500;
          margin-left: 8rpx;
          
          &:active {
            background: #7c3aed;
          }
        }
        
        .remove-tray-btn {
          background: #ef4444;
          color: #fff;
          padding: 6rpx 16rpx;
          border-radius: 6rpx;
          font-size: 24rpx;
          font-weight: 500;
          margin-left: 8rpx;
          
          &:active {
            background: #dc2626;
          }
        }
      }
      
      .card-content {
        padding: 20rpx 24rpx;
        display: flex;
        
        .left-section {
          flex: 1;
          padding-right: 20rpx;
        }
        
        .right-section {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-end;
          padding-left: 20rpx;
          border-left: 1px solid #f3f4f6;
          min-width: 120rpx;
        }
        
        .info-item {
          display: flex;
          margin-bottom: 16rpx;
          
          .info-label {
            flex: 0 0 140rpx;
            font-size: 26rpx;
            color: #6b7280;
          }
          
          .info-value {
            flex: 1;
            font-size: 28rpx;
            color: #1f2937;
            font-weight: 500;
            
            &.product-name {
              word-break: break-all;
              word-wrap: break-word;
              white-space: normal;
              line-height: 1.4;
            }
          }
          
          // 扫码添加按钮
          .scan-add-btn {
            background: #10b981;
            color: #fff;
            padding: 12rpx 24rpx;
            border-radius: 8rpx;
            font-size: 26rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            
            &:active {
              background: #059669;
            }
            
            .scan-btn-text {
              color: #ffffff;
              font-weight: 500;
            }
          }
        }
        
        // 发送按钮
        .send-button {
          background: #2563eb;
          color: #fff;
          padding: 12rpx 28rpx;
          border-radius: 8rpx;
          font-size: 26rpx;
          font-weight: 500;
          text-align: center;
          
          &:active {
            background: #1d4ed8;
          }
        }
        
        // 目的地输入框
        .destination-input-container {
          display: flex;
          flex-direction: column;
          width: 250rpx;
          
          .destination-input {
            border: 1px solid #d1d5db;
            border-radius: 8rpx;
            padding: 0 10rpx;
            font-size: 32rpx;
            margin-bottom: 16rpx;
            width: 100%;
            box-sizing: border-box;
            height: 40rpx;
            line-height: 40rpx;
          }
          
          .buttons-row {
            display: flex;
            width: 100%;
          }
          
          .send-btn, .cancel-btn {
            flex: 1;
            padding: 12rpx 0;
            border-radius: 8rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 26rpx;
            font-weight: 500;
          }
          
          .send-btn {
            background: #2563eb;
            color: #fff;
            margin-left: 8rpx;
            
            &:active {
              background: #1d4ed8;
            }
          }
          
          .cancel-btn {
            background: #f3f4f6;
            color: #4b5563;
            
            &:active {
              background: #e5e7eb;
            }
          }
        }
        
        // 发送状态和目的地
        .sending-status {
          margin-top: 8rpx;
          text-align: center;
          
          .status-label, .destination-label {
            font-size: 24rpx;
            color: #6b7280;
            margin-bottom: 8rpx;
            white-space: nowrap;
            
            .status-value, .destination-value {
              color: #2563eb;
              font-weight: 500;
            }
          }
        }
      }
    }
    
    // 无数据状态
    .empty-state {
      padding: 80rpx 0;
      text-align: center;
      
      .empty-text {
        font-size: 28rpx;
        color: #9ca3af;
      }
    }
  }
  
  // 移位模态框样式
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    
    .modal-content {
      width: 90%;
      max-width: 650rpx;
      background: #fff;
      border-radius: 16rpx;
      overflow: hidden;
      box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.2);
      
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24rpx;
        border-bottom: 1px solid #f3f4f6;
        
        .modal-title {
          font-size: 32rpx;
          font-weight: 600;
          color: #1f2937;
        }
        
        .modal-close {
          font-size: 40rpx;
          color: #6b7280;
          padding: 0 16rpx;
          
          &:active {
            color: #374151;
          }
        }
      }
      
      .modal-body {
        padding: 24rpx 24rpx;
        max-height: 800rpx;
        overflow-y: auto;
        
        .position-list {
          display: flex;
          flex-direction: column;
          gap: 24rpx;
        }
        
        .position-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24rpx;
          border-radius: 8rpx;
          border: 1px solid #e5e7eb;
          transition: all 0.2s;
          
          &:not(:last-child) {
            margin-bottom: 4rpx;
          }
          
          &.selected {
            border-color: #2563eb;
            background: rgba(37, 99, 235, 0.05);
          }
          
          &:active {
            background: rgba(0, 0, 0, 0.02);
          }
          
          .position-name {
            font-size: 28rpx;
            font-weight: 500;
            color: #1f2937;
            padding: 4rpx 0;
          }
          
          .position-status {
            font-size: 26rpx;
            padding: 4rpx 0;
            
            .has-tray {
              color: #f59e0b;
            }
            
            .no-tray {
              color: #10b981;
            }
          }
        }
      }
      
      .modal-footer {
        display: flex;
        padding: 24rpx;
        border-top: 1px solid #f3f4f6;
        
        .modal-btn {
          flex: 1;
          text-align: center;
          padding: 20rpx 0;
          font-size: 28rpx;
          font-weight: 500;
          border-radius: 8rpx;
          
          &.cancel {
            background: #f3f4f6;
            color: #4b5563;
            margin-right: 16rpx;
            
            &:active {
              background: #e5e7eb;
            }
          }
          
          &.confirm {
            background: #2563eb;
            color: #fff;
            
            &:active {
              background: #1d4ed8;
            }
            
            &.disabled {
              background: #93c5fd;
              color: #eff6ff;
              pointer-events: none;
            }
          }
        }
      }
    }
  }
}
</style> 