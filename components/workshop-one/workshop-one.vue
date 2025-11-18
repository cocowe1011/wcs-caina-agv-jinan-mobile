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
          <view class="scan-btn" @click="handleScanCode">
            <text class="cuIcon-scan scan-icon"></text>
            <text class="scan-text">上货扫码</text>
          </view>
          <view class="refresh-btn" @click="fetchQueueData">
            <text class="refresh-text" :class="{'refreshing': loading}">刷新</text>
          </view>
        </view>
      </view>
      
      <!-- 加载指示器 -->
      <view class="loading-container" v-show="loading">
        <view class="loading-spinner"></view>
        <text class="loading-text">加载中...</text>
      </view>
      
      <view class="pallet-list">
        <view 
          v-for="(item, index) in currentQueueData" 
          :key="index"
          class="pallet-card"
          :class="{ 'is-locked': item.isLock === '1' }"
        >
          <!-- 锁定遮层 -->
          <view v-if="item.isLock === '1'" class="lock-overlay">
            <view class="lock-content">
              <text class="lock-icon">🔒</text>
              <text class="lock-text">此位置已被占用，正在等待AGV运输</text>
            </view>
          </view>
          
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
                  <text class="scan-btn-text">扫码添加临时托盘</text>
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

    <!-- AGV任务管理悬浮按钮 -->
    <view class="fab-btn" @click="toggleAgvTaskModal">
      <text class="fab-text">AGV</text>
      <text class="fab-text">任务</text>
    </view>

    <!-- 新增: AGV调度悬浮按钮 -->
    <view class="fab-btn agv-schedule-fab" @click="toggleAgvScheduleModal">
      <text class="fab-text">AGV</text>
      <text class="fab-text">调度</text>
    </view>

    <!-- 新增: 报警日志悬浮按钮 -->
    <view class="fab-btn alarm-fab" :class="{'has-unread-alarms': unreadAlarmCount > 0}" @click="toggleAlarmModal">
      <text class="fab-text">报警</text>
      <text class="fab-text">日志</text>
      <view v-if="unreadAlarmCount > 0" class="alarm-badge">{{ unreadAlarmCount }}</view>
    </view>

    <!-- AGV运行中任务管理弹窗 -->
    <view class="modal-overlay" v-if="showAgvTaskModal" @click="toggleAgvTaskModal">
      <view class="agv-task-modal-content" @click.stop>
        <view class="agv-task-modal-header">
          <view class="agv-task-modal-tabs">
            <view 
              class="agv-task-tab-item" 
              :class="{'active': currentAgvTaskTab === 'floor1'}" 
              @click="switchAgvTaskTab('floor1')">
              一层AGV运行中任务管理
            </view>
            <view 
              class="agv-task-tab-item" 
              :class="{'active': currentAgvTaskTab === 'floor2'}" 
              @click="switchAgvTaskTab('floor2')">
              二层AGV运行中任务管理
            </view>
            <view 
              class="agv-task-tab-item" 
              :class="{'active': currentAgvTaskTab === 'floor3'}" 
              @click="switchAgvTaskTab('floor3')">
              三层AGV运行中任务管理
            </view>
          </view>
          <view class="agv-task-refresh-btn" @click="fetchAgvTasks">
            <text class="refresh-text">刷新</text>
          </view>
        </view>
        
        <!-- 刷新状态条 -->
        <view class="refresh-status-bar" v-if="agvTasksLoading">
          <view class="loading-spinner small-spinner"></view>
          <text class="refresh-status-text">数据更新中...</text>
        </view>
        
        <view class="agv-task-modal-body">
          <scroll-view scroll-y="true" class="agv-task-list">
            <view class="agv-task-list-inner-content">
              <!-- 空状态提示 -->
              <view class="empty-state modal-empty-state" v-if="!agvTasksLoading && displayedAgvTasks.length === 0">
                <text class="empty-text">暂无运行中任务</text>
              </view>

              <!-- 任务列表 -->
              <view v-if="displayedAgvTasks.length > 0">
                <view 
                  v-for="task in displayedAgvTasks" 
                  :key="task.id" 
                  class="agv-task-card"
                >
                  <view class="agv-task-card-row">
                    <text class="agv-task-label">队列位置:</text>
                    <text class="agv-task-value">{{ task.queueName }}{{ task.queueNum }}</text>
                  </view>
                  <view class="agv-task-card-row">
                    <text class="agv-task-label">托盘号:</text>
                    <text class="agv-task-value">{{ task.trayInfo || '--' }}</text>
                  </view>
                  <view class="agv-task-card-row">
                    <text class="agv-task-label">产品描述:</text>
                    <text class="agv-task-value product-name">{{ task.trayInfoAdd || '--' }}</text>
                  </view>
                  <view class="agv-task-card-row">
                    <text class="agv-task-label">任务号:</text>
                    <text class="agv-task-value">{{ task.robotTaskCode || '--' }}</text>
                  </view>
                  <view class="agv-task-card-row">
                    <text class="agv-task-label">当前状态:</text>
                    <text class="agv-task-value status-text" :class="getAgvStatusClass(task.trayStatus)">{{ getAgvTaskStatusText(task) }}</text>
                  </view>
                  <view class="agv-task-card-row action-row">
                    <text class="agv-task-label">操作:</text>
                    <view class="agv-task-actions">
                      <text v-if="task.isWaitCancel === '1'" class="waiting-cancel-text">正在等待取消执行</text>
                      <view v-else class="cancel-task-btn" @click="confirmCancelAgvTask(task)">
                        取消执行
                      </view>
                    </view>
                  </view>
                </view>
                <!-- Add a spacer view after all cards -->
                <view class="scroll-bottom-spacer"></view>
              </view>
            </view>
          </scroll-view>
        </view>
         <view class="modal-footer">
            <view class="modal-btn confirm" @click="toggleAgvTaskModal">关闭</view>
        </view>
      </view>
    </view>

    <!-- 新增: AGV调度弹窗 -->
    <view class="modal-overlay" v-if="showAgvScheduleModal" @click="toggleAgvScheduleModal">
      <view class="agv-schedule-modal-content" @click.stop>
        <view class="agv-schedule-modal-header">
          AGV手动调度
        </view>
        <view class="agv-schedule-modal-body">
          <view class="schedule-input-group">
            <text class="schedule-label">起点：</text>
            <input 
              class="schedule-input" 
              type="text" 
              placeholder="输入或选择起点 (如: AGV2-1, C1)" 
              :value="agvScheduleData.startPosition"
              @input="(e) => handleAgvScheduleInput('startPosition', e.target.value)"
            />
            <!-- <picker mode="selector" :range="startAgvPositions" range-key="value" @change="(e) => handleAgvScheduleInput('startPosition', startAgvPositions[e.detail.value].value)">
              <view class="schedule-input picker-input">
                {{ agvScheduleData.startPosition || '选择起点' }}
              </view>
            </picker> -->
          </view>
          <view class="schedule-input-group">
            <text class="schedule-label">终点：</text>
            <input 
              class="schedule-input" 
              type="text" 
              placeholder="输入或选择终点 (如: AGV2-2, A10)" 
              :value="agvScheduleData.endPosition"
              @input="(e) => handleAgvScheduleInput('endPosition', e.target.value)"
            />
             <!-- <picker mode="selector" :range="endAgvPositions" range-key="value" @change="(e) => handleAgvScheduleInput('endPosition', endAgvPositions[e.detail.value].value)">
              <view class="schedule-input picker-input">
                {{ agvScheduleData.endPosition || '选择终点' }}
              </view>
            </picker> -->
          </view>
        </view>
        <view class="agv-schedule-modal-footer">
          <view class="schedule-btn single-exec-btn" @click="handleSingleModeChange">
            单次执行
          </view>
          <view 
            v-if="agvScheduleData.status === 'cycleRunning'" 
            class="schedule-btn stop-cycle-btn" 
            @click="handleAgvModeChange(false)">
            停止循环执行
          </view>
          <view 
            v-else 
            class="schedule-btn cycle-exec-btn" 
            @click="handleAgvModeChange(true)">
            循环执行
          </view>
          <view class="schedule-btn close-btn" @click="toggleAgvScheduleModal">
            关闭
          </view>
        </view>
      </view>
    </view>

    <!-- 新增: 报警日志弹窗 -->
    <view class="modal-overlay" v-if="showAlarmModal" @click="toggleAlarmModal">
      <view class="alarm-modal-content" @click.stop>
        <view class="alarm-modal-header">
          <text class="alarm-modal-title">2800车间报警日志</text>
          <view class="alarm-actions">
            <view class="connection-status" :class="{'connected': wsStatus.isConnected, 'disconnected': !wsStatus.isConnected}">
              <text class="status-dot"></text>
              <text class="status-text">{{ wsStatus.isConnected ? '已连接' : '未连接' }}</text>
            </view>
            <view class="alarm-refresh-btn" @click="refreshAlarmLogs">
              <text class="refresh-text">刷新</text>
            </view>
          </view>
        </view>
        
        <view class="alarm-modal-body">
          <scroll-view scroll-y="true" class="alarm-list">
            <!-- 空状态提示 -->
            <view class="empty-state alarm-empty-state" v-if="alarmLogs.length === 0">
              <text class="empty-icon">📢</text>
              <text class="empty-text">暂无报警日志</text>
              <text class="empty-desc">电脑端产生报警时会自动推送到此处</text>
            </view>

            <!-- 报警日志列表 -->
            <view v-if="alarmLogs.length > 0">
              <view 
                v-for="alarm in alarmLogs" 
                :key="alarm.id" 
                class="alarm-card"
                :class="{'unread': alarm.unread}"
                @click="markAlarmAsRead(alarm)"
              >
                <view class="alarm-card-header">
                  <view class="alarm-source">{{ alarm.source }}</view>
                  <view class="alarm-time">{{ formatAlarmTime(alarm.timestamp) }}</view>
                </view>
                <view class="alarm-message">{{ alarm.message }}</view>
                <view v-if="alarm.unread" class="unread-indicator">
                  <text class="unread-text">未读</text>
                </view>
              </view>
            </view>
          </scroll-view>
        </view>
        
        <view class="alarm-modal-footer">
          <view class="alarm-footer-actions">
            <view class="alarm-btn clear-btn" @click="clearAllAlarms" v-if="alarmLogs.length > 0">
              清空日志
            </view>
            <view class="alarm-btn mark-read-btn" @click="markAllAlarmsAsRead" v-if="unreadAlarmCount > 0">
              全部已读
            </view>
            <view class="alarm-btn close-btn" @click="toggleAlarmModal">
              关闭
            </view>
          </view>
        </view>
      </view>
    </view>
    
    <!-- PDA扫码组件 -->
    <pda-scan 
      :visible="showScanModal" 
      @close="handleScanClose" 
      @confirm="handleScanConfirm">
    </pda-scan>
  </view>
</template>

<script>
import request from '@/config/request.js'
import requestAgv from '@/config/requestAgv.js'
import AlarmWebSocketClient from '@/utils/WebSocketClient.js'
import PdaScan from '@/components/pda-scan/pda-scan.vue'

export default {
  name: 'workshop-one',
  components: {
    PdaScan
  },
  data() {
    return {
      // 扫码弹窗相关
      showScanModal: false,
      scanCallback: null, // 扫码成功后的回调函数
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
      availablePositions: [],
      // AGV任务管理相关
      showAgvTaskModal: false,
      currentAgvTaskTab: 'floor1', // Default tab: 'floor1', 'floor2', 'floor3'
      allAgvTasks: [], 
      agvTasksLoading: false,
      // 新增: AGV调度相关数据
      showAgvScheduleModal: false,
      agvScheduleData: {
        startPosition: '',
        endPosition: '',
        status: 'idle', // idle, singleRunning, cycleRunning
      },
      agvCodeMap: {
        'AGV2-1': '102', // 2800转盘出口，对应PLC的DBW8.2 AGV2-1空闲允许放货(PLC给RCS) -> 修改为2800出口给AGV
        'AGV2-2': '201', // AGV2-2队列，对应PLC的DBW8.2 AGV2-2空闲允许放货(PLC给RCS)
        'AGV2-3': '301', // AGV2-3队列，对应PLC的DBW8.3 AGV2-3空闲允许放货(PLC给RCS)
        '2500输送线': '101',// 2500提升机入口
        'AGV1-1': '202', // 一楼提升机出口
        'AGV3-1': '302'  // 三楼提升机出口
      },
      // 机械臂点位到站点ID的映射
      stationIdMap: {
        'a1': '11',
        'b1': '12',
        'c1': '13',
        'd1': '14',
        'e1': '15',
        'a2': '21',
        'b2': '22',
        'c2': '23',
        'd2': '24'
      },
      // 机械臂位置到固定ID的映射（与PC端保持一致）
      robotAreaIdMap: {
        a1: 602,
        b1: 603,
        c1: 604,
        d1: 605,
        e1: 606,
        a2: 607,
        b2: 608,
        c2: 609,
        d2: 610,
        e2: 611
      },
      // 这些列表可以用于未来的校验或picker组件
      // startAgvPositions: [ { value: 'AGV2-1' }, { value: 'AGV1-1' }, { value: 'AGV3-1' } ],
      // endAgvPositions: [{ value: 'AGV2-2' }, { value: 'AGV2-3' }],
      
      // 报警日志相关
      showAlarmModal: false,
      alarmLogs: [],
      wsClient: null,
      wsStatus: {
        isConnected: false
      }
    }
  },
  computed: {
    currentQueueData() {
      const code = this.tabs[this.currentTab].code;
      return this.queueData[code] || [];
    },
    displayedAgvTasks() {
      if (!this.allAgvTasks || this.allAgvTasks.length === 0) return [];
      
      // 扩展运行中的状态，包括机械臂相关状态
      const runningStatuses = ['0', '1', '20', '21', '3', '4', '6', '7', '23', '24', '11', '12', '16', '17', '19', '25'];
      const activeTasks = this.allAgvTasks.filter(task => 
        task && task.id && task.trayInfo && runningStatuses.includes(task.trayStatus)
      );

      let floorTasks = [];

      if (this.currentAgvTaskTab === 'floor1') {
        floorTasks = activeTasks.filter(task => 
          task.queueName === 'AGV2-2' && ['6', '7'].includes(task.trayStatus)
        );
      } else if (this.currentAgvTaskTab === 'floor2') {
        floorTasks = activeTasks.filter(task => 
          ['0', '1', '20', '21', '3', '4', '23', '24', '11', '12', '16', '17', '19', '25'].includes(task.trayStatus)
        );
      } else if (this.currentAgvTaskTab === 'floor3') {
        floorTasks = activeTasks.filter(task => 
          task.queueName === 'AGV2-3' && ['6', '7'].includes(task.trayStatus)
        );
      }
      return floorTasks;
    },
    
    // 未读报警数量
    unreadAlarmCount() {
      return this.alarmLogs.filter(alarm => alarm.unread).length;
    }
  },
  created() {
    this.fetchQueueData();
    this.initWebSocket();
  },
  beforeDestroy() {
    // 组件销毁前断开WebSocket连接
    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient = null;
    }
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
          return '2800已取,正运往缓存区';
        case '2':
          return '已送至二楼缓存区';
        case '20':
          return '在缓存区等待AGV取货';
        case '21':
          return '已在缓存区取货，正运往目的地';
        case '3':
          return '在缓存区等待AGV取货';
        case '4':
          return '缓存区已取,正运往目的地';
        case '23':
          return '在缓存区等待AGV取货（送往机械臂）';
        case '24':
          return '已在缓存区取货，正运往机械臂';
        case '11':
          return '在机械臂位置等待AGV取货';
        case '12':
          return 'AGV已在机械臂位置取货，正运往目的地';
        case '16':
          return '在空托盘区等待AGV取货';
        case '17':
          return 'AGV已在空托盘区取货，正运往C区';
        case '19':
          return '杂物托盘已送至输送线';
        case '25':
          return '已送至机械臂目的地';
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
        case '20':
          return 'status-waiting';
        case '21':
          return 'status-moving';
        case '3':
          return 'status-waiting';
        case '4':
          return 'status-moving';
        case '23':
          return 'status-waiting';
        case '24':
          return 'status-moving';
        case '11':
          return 'status-waiting';
        case '12':
          return 'status-moving';
        case '16':
          return 'status-waiting';
        case '17':
          return 'status-moving';
        case '19':
          return 'status-moving';
        case '25':
          return 'status-delivered';
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
      
      // 判断目的地类型，决定任务类型和终点代码
      const destination = item.destination;
      let taskType = '';
      let fromSiteCode = '';
      let toSiteCode = '';
      
      // 检查起点限制：发往一楼目的地D，起点只能是一楼货物缓存库位；发往三楼目的地E，起点只能是三楼货物缓存库位
      if (destination.startsWith('D')) {
        // 一楼目的地，起点必须是一楼货物缓存库位(C)
        if (item.queueName !== 'C') {
          uni.showToast({
            title: '发往一楼目的地D，起点只能是一楼货物缓存库位',
            icon: 'none'
          });
          this.loading = false;
          this.$set(item, 'showDestinationInput', true);
          return;
        }
        // 一楼目的地，发送到AGV2-2队列
        taskType = 'PF-FMR-COMMON-JH2'; // 从缓存区到输送线
        fromSiteCode = item.queueName + item.queueNum;
        toSiteCode = '201'; // AGV2-2队列
      } else if (destination.startsWith('E')) {
        // 三楼目的地，起点必须是三楼货物缓存库位(B)
        if (item.queueName !== 'B') {
          uni.showToast({
            title: '发往三楼目的地E，起点只能是三楼货物缓存库位',
            icon: 'none'
          });
          this.loading = false;
          this.$set(item, 'showDestinationInput', true);
          return;
        }
        // 三楼目的地，发送到AGV2-3队列
        taskType = 'PF-FMR-COMMON-JH2'; // 从缓存区到输送线
        fromSiteCode = item.queueName + item.queueNum;
        toSiteCode = '301'; // AGV2-3队列
      } else {
        // 不支持的目的地格式
        uni.showToast({
          title: '输入的目的地不支持，请输入D*或E*格式',
          icon: 'none'
        });
        this.loading = false;
        this.$set(item, 'showDestinationInput', true);
        return;
      }
      
      this.sendAgvCommand(taskType, fromSiteCode, toSiteCode)
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
                  // 恢复发送面板状态
                  this.$set(item, 'showDestinationInput', true);
                }
              })
              .catch(err => {
                uni.showToast({
                  title: '托盘状态更新失败',
                  icon: 'none'
                });
                // 恢复发送面板状态
                this.$set(item, 'showDestinationInput', true);
              })
              .finally(() => {
                this.loading = false;
              });
          } else {
            uni.showToast({
              title: 'AGV指令发送失败',
              icon: 'none'
            });
            // 恢复发送面板状态
            this.$set(item, 'showDestinationInput', true);
            this.loading = false;
          }
        })
        .catch(err => {
          uni.showToast({
            title: '发送指令失败',
            icon: 'none'
          });
          // 恢复发送面板状态
          this.$set(item, 'showDestinationInput', true);
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
        uni.showToast({
            title: '发送AGV指令失败:' + JSON.stringify(err),
            icon: 'none'
          });
        return '';
      }
    },
    
    // 取消发送
    cancelSend(item) {
      this.$set(item, 'showDestinationInput', false);
      this.$set(item, 'destination', '');
    },
    
    // 扫码添加临时托盘功能
    scanToAddWasteTray(item) {
      // 使用PDA扫码组件
      this.openScanModal((scanCode) => {
        // 扫码成功后，将扫码结果作为trayInfo传递
        this.updateToWasteTray(item, scanCode);
      });
    },
    
    // 更新为临时托盘
    async updateToWasteTray(item, scanResult) {
      this.loading = true;
      
      // 先调用AGV绑定接口
      const slotCode = item.queueName + item.queueNum;
      const bindSuccess = await this.sendAgvBindCommand(slotCode);
      
      if (!bindSuccess) {
        uni.showToast({
          title: 'AGV绑定失败，但将继续添加托盘',
          icon: 'none'
        });
      }
      
      const param = {
        id: item.id,
        trayInfo: scanResult, // 使用扫码得到的条码作为trayInfo
        trayStatus: '2',
        trayInfoAdd: '临时托盘'
      };
      
      request.post('/queue_info/update', param)
        .then(res => {
          if (res.code === '200' && res.data == 1) {
            uni.showToast({
              title: '临时托盘添加成功',
              icon: 'success'
            });
            
            // 更新本地数据
            this.$set(item, 'trayInfo', scanResult); // 使用扫码结果
            this.$set(item, 'trayStatus', '2');
            this.$set(item, 'trayInfoAdd', '临时托盘');
            
            // 重新加载当前区域数据
            this.fetchQueueData();
          } else {
            uni.showToast({
              title: '临时托盘添加失败',
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
    async executePalletMove() {
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
      
      const sourceSlotCode = sourcePallet.queueName + sourcePallet.queueNum;
      const targetSlotCode = targetPallet.queueName + targetPallet.queueNum;
      
      // 如果目标位置没有托盘信息，直接移动
      if (!targetPallet.trayInfo) {
        // 情况：源位置托盘移到空位置
        // 需要：在目标位置绑定，在源位置解绑
        
        // 先在目标位置绑定
        const bindSuccess = await this.sendAgvBindCommand(targetSlotCode);
        if (!bindSuccess) {
          uni.showToast({
            title: '目标位置AGV绑定失败，但将继续移动托盘',
            icon: 'none'
          });
        }
        
        // 再在源位置解绑
        const unbindSuccess = await this.sendAgvUnbindCommand(sourceSlotCode);
        if (!unbindSuccess) {
          uni.showToast({
            title: '源位置AGV解绑失败，但将继续移动托盘',
            icon: 'none'
          });
        }
        
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
        // 情况：两个位置互换托盘，AGV只需要知道这两个位置都有托盘，不需要额外绑定/解绑
        console.log(`托盘互换：${sourceSlotCode} ↔ ${targetSlotCode}，无需AGV绑定操作`);
        
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
    async removeTray(item) {
      this.loading = true;
      
      // 先调用AGV解绑接口
      const slotCode = item.queueName + item.queueNum;
      const unbindSuccess = await this.sendAgvUnbindCommand(slotCode);
      
      if (!unbindSuccess) {
        uni.showToast({
          title: 'AGV解绑失败，但将继续移除托盘',
          icon: 'none'
        });
      }
      
      const param = {
        id: item.id,
        trayInfo: '',
        trayStatus: '',
        trayInfoAdd: '',
        robotTaskCode: '',
        targetPosition: '',
        isWaitCancel: '',
        isLock: '',
        mudidi: '',
        targetId: 0
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
      // 使用PDA扫码组件
      this.openScanModal((scanCode) => {
        // 扫码成功后，将扫码结果作为trayInfo传递
        this.updateTrayCode(item, scanCode);
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
    },

    // --- AGV任务管理方法 ---
    toggleAgvTaskModal() {
      this.showAgvTaskModal = !this.showAgvTaskModal;
      if (this.showAgvTaskModal) {
        this.currentAgvTaskTab = 'floor1'; // 重置到默认tab
        this.fetchAgvTasks(); 
      } else {
        // 关闭弹窗时刷新主列表
        this.fetchQueueData();
      }
    },
    switchAgvTaskTab(tabName) {
      this.currentAgvTaskTab = tabName;
      // displayedAgvTasks 会自动更新
    },
    async fetchAgvTasks() {
      this.agvTasksLoading = true;
      try {
        const res = await request.post('/queue_info/queryQueueList', {});
        if (res.code === '200' && Array.isArray(res.data)) {

          // 更新数据
          this.allAgvTasks = res.data;
          
          // 使用nextTick确保DOM更新后
          this.$nextTick(() => {
            setTimeout(() => {
              this.agvTasksLoading = false;
            }, 300);
          });
        } else {
          this.allAgvTasks = [];
          uni.showToast({ title: '获取AGV任务列表失败' + (res.msg ? ': ' + res.msg : ''), icon: 'none' });
          this.agvTasksLoading = false;
        }
      } catch (err) {
        this.allAgvTasks = [];
        uni.showToast({ title: '网络请求AGV任务失败', icon: 'none' });
        console.error('获取AGV任务列表失败:', err);
        this.agvTasksLoading = false;
      }
    },
    getAgvTaskStatusText(task) {
      const statusMap = {
        '0': '在2800等待AGV取货',
        '1': '已在2800取货，正往缓存区运送',
        '20': '在缓存区等待AGV取货',
        '21': '已在缓存区取货，正往运往目的地',
        '3': '在缓存区等待AGV取货',
        '4': '已在缓存区取货，正往运往目的地',
        '6': task.queueName === 'AGV2-2' ? '等待一楼AGV取货' : '等待三楼AGV取货',
        '7': task.queueName === 'AGV2-2'
            ? 'AGV已在一楼AGV1-1取货，正运往目的地'
            : 'AGV已在三楼AGV3-1取货，正运往目的地',
        '23': '在缓存区等待AGV取货（送往机械臂）',
        '24': '已在缓存区取货，正运往机械臂',
        '11': '在机械臂位置等待AGV取货',
        '12': 'AGV已在机械臂位置取货，正运往目的地',
        '16': '在空托盘区等待AGV取货',
        '17': 'AGV已在空托盘区取货，正运往C区',
        '19': '杂物托盘已送至输送线',
        '25': '已送至机械臂目的地'
      };
      return statusMap[task.trayStatus] || `未知状态 (${task.trayStatus})`;
    },
    getAgvStatusClass(status) {
        // 与主列表状态样式保持一致或自定义
        switch(status) {
            case '0': return 'status-waiting'; // 在2800等待AGV取货
            case '1': return 'status-moving';  // 已在2800取货，正往缓存区运送
            case '20': return 'status-waiting'; // 在缓存区等待AGV取货
            case '21': return 'status-moving';  // 已在缓存区取货，正往运往目的地
            case '3': return 'status-waiting'; // 在缓存区等待AGV取货
            case '4': return 'status-moving';  // 已在缓存区取货，正往运往目的地
            case '6': return 'status-waiting'; // 等待一楼AGV取货
            case '7': return 'status-moving';  // AGV已在一楼AGV1-1取货，正运往目的地
            case '23': return 'status-waiting'; // 在缓存区等待AGV取货（送往机械臂）
            case '24': return 'status-moving';  // 已在缓存区取货，正运往机械臂
            case '11': return 'status-waiting'; // 在机械臂位置等待AGV取货
            case '12': return 'status-moving';  // AGV已在机械臂位置取货，正运往目的地
            case '16': return 'status-waiting'; // 在空托盘区等待AGV取货
            case '17': return 'status-moving';  // AGV已在空托盘区取货，正运往C区
            case '19': return 'status-moving';  // 杂物托盘已送至输送线
            case '25': return 'status-delivered'; // 已送至机械臂目的地
            default: return '';
        }
    },
    confirmCancelAgvTask(task) {
        uni.showModal({
            title: '确认取消任务',
            content: `确定要取消托盘 ${task.trayInfo || '未知'} 的AGV任务吗？`,
            success: async (res) => {
                if (res.confirm) {
                    await this.executeCancelAgvTask(task);
                }
            }
        });
    },
    async executeCancelAgvTask(task) {
      if (!task || !task.id) {
        uni.showToast({ title: '任务信息错误', icon: 'none' });
        return;
      }
      this.agvTasksLoading = true;
      
      const robotTaskCode = await this.sendCancelAgvCommand(task.robotTaskCode, task.trayInfo);
      if (robotTaskCode !== '') {
        // 调用取消AGV任务的API
        request.post('/queue_info/update', {
          id: task.id,
          isWaitCancel: '1'
        })
          .then((res) => {
            if (res.code === '200' && res.data == 1) {
              uni.showToast({ title: '任务取消请求已发送', icon: 'success' });
              // 刷新任务列表
              this.fetchAgvTasks();
            } else {
              uni.showToast({ title: '任务取消请求失败', icon: 'none' });
              this.agvTasksLoading = false;
            }
          })
          .catch((err) => {
            console.error('取消AGV任务失败:', err);
            uni.showToast({ title: '取消AGV任务失败', icon: 'none' });
            this.agvTasksLoading = false;
          });
      } else {
        this.agvTasksLoading = false;
      }
    },
    
    // 发送AGV取消任务指令
    async sendCancelAgvCommand(robotTaskCode, trayInfo) {
      // 测试用，返回当前时间戳
      // return Date.now().toString(); 
      // 上面的测试代码保留，实际对接时移除
      // 组装入参
      const params = {
        robotTaskCode: robotTaskCode,
        cancelType: 'DROP'
      };
      
      try {
        // 发送AGV指令
        const res = await requestAgv.post(
          '/rcs/rtas/api/robot/controller/task/cancel',
          params
        );
        if (res.code === 'SUCCESS') {
          uni.showToast({
            title: 'AGV任务取消指令已发送',
            icon: 'success'
          });
          // 成功时返回robotTaskCode
          return res.data.robotTaskCode;
        } else {
          // 处理各种错误类型
          let errorMsg = '';
          switch (res.errorCode) {
            case 'Err_TaskFinished':
              errorMsg = '任务已结束';
              break;
            case 'Err_TaskNotFound':
              errorMsg = '任务找不到';
              break;
            case 'Err_TaskModifyReject':
              errorMsg = '任务当前无法变更';
              break;
            case 'Err_TaskTypeNotSupport':
              errorMsg = '新任务任务类型不支持';
              break;
            case 'Err_RobotGroupsNotMatch':
              errorMsg = '机器人资源组编号与新任务不匹配，无法调度';
              break;
            case 'Err_RobotCodesNotMatch':
              errorMsg = '机器人编号与新任务不匹配，无法调度';
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
        uni.showToast({
          title: '发送AGV取消指令失败',
          icon: 'none'
        });
        return '';
      }
    },
    // --- 新增: AGV调度相关方法 ---
    toggleAgvScheduleModal() {
      this.showAgvScheduleModal = !this.showAgvScheduleModal;
      if (!this.showAgvScheduleModal) {
        // 重置状态和输入
        this.agvScheduleData = {
          startPosition: '',
          endPosition: '',
          status: 'idle'
        };
        // 关闭弹窗时刷新列表
        this.fetchQueueData();
      }
    },

    handleAgvScheduleInput(field, value) {
      this.agvScheduleData[field] = value;
    },
    
    // 循环执行/停止循环 (目前仅占位)
    handleAgvModeChange(isStartCycle) {
      if (!this.agvScheduleData.startPosition || !this.agvScheduleData.endPosition) {
        uni.showToast({ title: '请先选择起点和终点', icon: 'none' });
        return;
      }
      if (this.agvScheduleData.startPosition === this.agvScheduleData.endPosition) {
        uni.showToast({ title: '起点和终点不能相同', icon: 'none' });
        return;
      }

      if (isStartCycle) {
        if (this.agvScheduleData.status === 'singleRunning') {
          uni.showToast({ title: '当前正在单次执行，请等待完成后再开始循环', icon: 'none' });
          return;
        }
        this.agvScheduleData.status = 'cycleRunning';
        uni.showToast({ title: '循环执行已启动（功能开发中）', icon: 'none' });
        // TODO: 实现循环逻辑, 参考FloorFirst.vue, 可能涉及定时器和状态检查
      } else {
        this.agvScheduleData.status = 'idle';
        uni.showToast({ title: '循环执行已停止', icon: 'none' });
        // TODO: 清理循环相关的定时器等
      }
    },

    async handleSingleModeChange() {
      if (!this.agvScheduleData.startPosition || !this.agvScheduleData.endPosition) {
        uni.showToast({ title: '请先选择起点和终点', icon: 'none' });
        return;
      }
      if (this.agvScheduleData.startPosition === this.agvScheduleData.endPosition) {
        uni.showToast({ title: '起点和终点不能相同', icon: 'none' });
        return;
      }
      if (this.agvScheduleData.status === 'cycleRunning') {
        uni.showToast({ title: '当前正在循环执行，请先停止循环执行', icon: 'none' });
        return;
      }

      // 添加确认对话框
      try {
        await new Promise((resolve, reject) => {
          uni.showModal({
            title: '确认执行',
            content: `确认执行AGV单次调度任务吗？\n起点：${this.agvScheduleData.startPosition}\n终点：${this.agvScheduleData.endPosition}`,
            success: (res) => {
              if (res.confirm) {
                resolve();
              } else {
                reject();
              }
            },
            fail: () => {
              reject();
            }
          });
        });
      } catch {
        // 用户取消了操作
        return;
      }
      
      // PF-FMR-COMMON-JH	转盘-输送线，起点终点都与plc进行安全交互
      // PF-FMR-COMMON-JH1 转盘-缓存区，只有起点与plc进行安全交互
      // PF-FMR-COMMON-JH2 缓存区-输送线，只有终点与plc进行安全交互
      // 判断起点类型
      let taskType = '';
      let fromSiteCode = '';
      let toSiteCode = '';

      const startPos = this.agvScheduleData.startPosition.trim();
      const endPos = this.agvScheduleData.endPosition.trim(); // 保留原始大小写

      if (startPos === 'AGV2-1') {
        // 说明起点是转盘
        fromSiteCode = this.agvCodeMap[startPos];

        if (endPos.includes('AGV')) {
          // 转盘-输送线，起点终点都与plc进行安全交互
          // todo 这种方式先不处理占位问题
          taskType = 'PF-FMR-COMMON-JH';
          toSiteCode = this.agvCodeMap[endPos];
          this.agvScheduleData.status = 'singleRunning';
          // 调用发送AGV指令方法
          this.sendAgvCommand(taskType, fromSiteCode, toSiteCode);
        } else {
          // 转盘-缓存区，只有起点与plc进行安全交互
          taskType = 'PF-FMR-COMMON-JH1';
          toSiteCode = endPos;
          // 判断目的地缓存位有没有托盘占位，如果有直接报错提示，并返回
          try {
            const queueName = endPos.charAt(0);
            const queueNum = endPos.substring(1);
            const res = await request.post('/queue_info/queryQueueList', {
              queueName,
              queueNum
            });
            if (res.code === '200' && res.data && res.data.length > 0) {
              if ((res.data[0].trayInfo === null || res.data[0].trayInfo === '') && res.data[0].isLock !== '1') {
                this.agvScheduleData.status = 'singleRunning';
                // 调用发送AGV指令方法
                const robotTaskCode = await this.sendAgvCommand(
                  taskType,
                  fromSiteCode,
                  toSiteCode
                );
                if (robotTaskCode !== '') {
                  // 转盘-缓存区
                  const param = {
                    id: res.data[0].id,
                    trayInfo: '1111111',
                    trayStatus: '0',
                    robotTaskCode,
                    trayInfoAdd: '临时托盘'
                  };
                  request.post('/queue_info/update', param)
                    .then((returnRes) => {
                      if (returnRes.code === '200' && returnRes.data == 1) {
                        console.log(`手动调度去往缓存区：${toSiteCode}成功！`);
                        uni.showToast({
                          title: `手动调度去往缓存区：${toSiteCode}成功！`,
                          icon: 'success'
                        });
                      } else {
                        console.log(`手动调度去往缓存区：${toSiteCode}失败！`);
                        uni.showToast({
                          title: `手动调度去往缓存区：${toSiteCode}失败！`,
                          icon: 'none'
                        });
                      }
                    })
                    .catch((err) => {
                      console.log(
                        `手动调度去往缓存区：${toSiteCode}失败！${err}`
                      );
                      uni.showToast({
                        title: `手动调度去往缓存区：${toSiteCode}失败！${err}`,
                        icon: 'none'
                      });
                    });
                }
              } else {
                uni.showToast({
                  title: `目的地：${toSiteCode}缓存位有托盘占位，请检查。`,
                  icon: 'none'
                });
                console.log(`目的地：${toSiteCode}缓存位有托盘占位，请检查。`);
              }
            } else {
              console.log('没有此缓存区位置，请检查输入的缓存区位置是否正确');
              uni.showToast({
                title: '没有此缓存区位置，请检查输入的缓存区位置是否正确',
                icon: 'none'
              });
            }
          } catch (e) {
            uni.showToast({
              title: '检查目标缓存区异常',
              icon: 'none'
            });
            this.agvScheduleData.status = 'idle';
            return;
          }
        }
      } else if (
        startPos === 'AGV1-1' ||
        startPos === 'AGV3-1'
      ) {
        // 说明起点是AGV1-1或AGV3-1
        fromSiteCode = this.agvCodeMap[startPos];
        if (
          (startPos === 'AGV1-1' &&
            endPos.includes('D')) ||
          (startPos === 'AGV3-1' &&
            endPos.includes('E'))
        ) {
          // AGV1-1-输送线，只有终点与plc进行安全交互
          taskType = 'PF-FMR-COMMON-JH4';
          toSiteCode = endPos;
          this.agvScheduleData.status = 'singleRunning';
          // 调用发送AGV指令方法
          this.sendAgvCommand(taskType, fromSiteCode, toSiteCode);
        } else {
          // 目前没有这种类型，报错
          taskType = 'ERROR';
          console.log(
            `${startPos}发送到${endPos}，没有这种任务类型，请检查！`
          );
          uni.showToast({
            title: `${startPos}发送到${endPos}，没有这种任务类型，请检查！`,
            icon: 'none'
          });
        }
      } else if (
        startPos.startsWith('A') &&
        ['a1', 'a2', 'b1', 'b2', 'd1', 'd2', 'e1', 'c1', 'c2'].includes(endPos)
      ) {
        // A区到机械臂（PF-FMR-COMMON-JH2） - 与PC端逻辑保持一致
        taskType = 'PF-FMR-COMMON-JH2';
        fromSiteCode = startPos;
        toSiteCode = this.convertToStationId(endPos);
        this.agvScheduleData.status = 'singleRunning';
        
        // 发送时判断队列数据，如果有队列数据则一起处理
        await this.handleAgvSendWithQueueCheck(
          taskType,
          fromSiteCode,
          toSiteCode,
          endPos
        );
      } else {
        // 说明起点是缓存区
        fromSiteCode = startPos;
        if (endPos.includes('AGV')) {
          // 缓存区-输送线，只有终点与plc进行安全交互
          // taskType = 'PF-FMR-COMMON-JH2';
          // toSiteCode = this.agvCodeMap[endPos];
          // // 判断起点缓存位有没有托盘占位，如果没有直接报错提示，并返回
          // try {
          //   const queueName = fromSiteCode.charAt(0);
          //   const queueNum = fromSiteCode.substring(1);
          //   const res = await request.post('/queue_info/queryQueueList', {
          //     queueName,
          //     queueNum
          //   });
          //   if (res.code === '200' && res.data && res.data.length > 0) {
          //     if (res.data[0].trayInfo === null || res.data[0].trayInfo === '') {
          //       console.log(`起点：${fromSiteCode}没有信息，请扫码录入信息。`);
          //       uni.showToast({
          //         title: `起点：${fromSiteCode}没有信息，请扫码录入信息。`,
          //         icon: 'none'
          //       });
          //     } else {
          //       this.agvScheduleData.status = 'singleRunning';
          //       // 调用发送AGV指令方法
          //       const robotTaskCode = await this.sendAgvCommand(
          //         taskType,
          //         fromSiteCode,
          //         toSiteCode
          //       );
          //       if (robotTaskCode !== '') {
          //         // 缓存区-输送线
          //         const param = {
          //           id: res.data[0].id,
          //           trayStatus: '3', // -在缓存区等待AGV取货
          //           robotTaskCode,
          //           targetPosition: endPos // 保存目的地信息
          //         };
          //         request.post('/queue_info/update', param)
          //           .then((returnRes) => {
          //             if (returnRes.code === '200' && returnRes.data == 1) {
          //               console.log(
          //                 `从${fromSiteCode}手动调度去往${toSiteCode}成功！`
          //               );
          //               uni.showToast({
          //                 title: `从${fromSiteCode}手动调度去往${toSiteCode}成功！`,
          //                 icon: 'success'
          //               });
          //             } else {
          //               console.log(`手动调度去往缓存区：${toSiteCode}失败！`);
          //               uni.showToast({
          //                 title: `手动调度去往缓存区：${toSiteCode}失败！`,
          //                 icon: 'none'
          //               });
          //             }
          //           })
          //           .catch((err) => {
          //             console.log(
          //               `手动调度去往缓存区：${toSiteCode}失败！${err}`
          //             );
          //             uni.showToast({
          //               title: `手动调度去往缓存区：${toSiteCode}失败！${err}`,
          //               icon: 'none'
          //             });
          //           });
          //       }
          //     }
          //   } else {
          //     uni.showToast({
          //       title: '未查到此起点信息，请检查输入的缓存区位置是否正确',
          //       icon: 'none'
          //     });
          //     console.log('未查到此起点信息，请检查输入的缓存区位置是否正确');
          //   }
          // } catch (e) {
          //   uni.showToast({
          //     title: '检查起点缓存区异常',
          //     icon: 'none'
          //   });
          //   this.agvScheduleData.status = 'idle';
          //   return;
          // }
          uni.showToast({
            title: `不可直接发送到输送线`,
            icon: 'none'
          });
        } else {
          // 缓存区-缓存区
          taskType = 'PF-FMR-COMMON-PY';
          toSiteCode = endPos;
          fromSiteCode = startPos;
          
          try {
            // 判断起点缓存位有没有托盘占位，如果没有直接报错提示，并返回
            const resQiDian = await request.post('/queue_info/queryQueueList', {
              queueName: fromSiteCode.charAt(0),
              queueNum: fromSiteCode.substring(1)
            });
            
            if (resQiDian.code === '200' && resQiDian.data && resQiDian.data.length > 0) {
              if (resQiDian.data[0].trayInfo === null || resQiDian.data[0].trayInfo === '') {
                uni.showToast({
                  title: `起点：${fromSiteCode}没有信息，请扫码录入信息。`,
                  icon: 'none'
                });
                this.agvScheduleData.status = 'idle';
                return;
              } else {
                // 判断目的地缓存位有没有托盘占位，如果有直接报错提示，并返回
                const res = await request.post('/queue_info/queryQueueList', {
                  queueName: toSiteCode.charAt(0),
                  queueNum: toSiteCode.substring(1)
                });
                
                if (res.code === '200' && res.data && res.data.length > 0) {
                  if (
                    (res.data[0].trayInfo === null || res.data[0].trayInfo === '') &&
                    res.data[0].isLock !== '1'
                  ) {
                    this.agvScheduleData.status = 'singleRunning';
                    // 调用发送AGV指令方法
                    const robotTaskCode = await this.sendAgvCommand(
                      taskType,
                      fromSiteCode,
                      toSiteCode
                    );
                    
                    if (robotTaskCode !== '') {
                      // 缓存区-缓存区：使用批量更新，锁定目标位置并设置起点状态
                      const param = [
                        {
                          id: resQiDian.data[0].id,
                          trayStatus: '20',
                          robotTaskCode,
                          targetPosition: toSiteCode,
                          targetId: res.data[0].id
                        },
                        {
                          id: res.data[0].id,
                          isLock: '1'
                        }
                      ];
                      
                      request.post('/queue_info/updateByList', param)
                        .then((returnRes) => {
                          if (returnRes.code === '200' && returnRes.data == 1) {
                            uni.showToast({
                              title: `手动调度去往缓存区：${toSiteCode}成功！`,
                              icon: 'success'
                            });
                          } else {
                            uni.showToast({
                              title: `手动调度去往缓存区：${toSiteCode}失败！`,
                              icon: 'none'
                            });
                          }
                        })
                        .catch((err) => {
                          uni.showToast({
                            title: `手动调度去往缓存区：${toSiteCode}失败！${err}`,
                            icon: 'none'
                          });
                        });
                    }
                  } else {
                    uni.showToast({
                      title: `目的地：${toSiteCode}缓存位有托盘占位，请检查。`,
                      icon: 'none'
                    });
                  }
                } else {
                  uni.showToast({
                    title: '没有此目标缓存区位置，请检查输入的缓存区位置是否正确',
                    icon: 'none'
                  });
                  this.agvScheduleData.status = 'idle';
                }
              }
            } else {
              uni.showToast({
                title: '没有此起点缓存区位置，请检查输入的缓存区位置是否正确',
                icon: 'none'
              });
              this.agvScheduleData.status = 'idle';
            }
          } catch (e) {
            uni.showToast({
              title: '检查缓存区异常',
              icon: 'none'
            });
            this.agvScheduleData.status = 'idle';
            return;
          }
        }
      }
    },

    // 将机械臂点位转换为站点ID的辅助方法
    convertToStationId(siteCode) {
      // 检查是否是机械臂点位（a1, b1, c1, d1, e1, a2, b2, c2, d2）
      const lowerSiteCode = siteCode.toLowerCase();
      if (this.stationIdMap[lowerSiteCode]) {
        return this.stationIdMap[lowerSiteCode];
      }
      return siteCode; // 如果不是机械臂点位，返回原始值
    },
    
    // A区到机械臂的AGV调度（带队列数据检查）- 与PC端逻辑完全一致
    async handleAgvSendWithQueueCheck(taskType, fromSiteCode, toSiteCode, targetPosition) {
      try {
        // 1. 首先查询A区的队列数据
        const aQueueRes = await request.post('/queue_info/queryQueueList', {
          queueName: 'A'
        });
        
        let queueDataToProcess = null;
        
        if (aQueueRes.code === '200' && aQueueRes.data && aQueueRes.data.length > 0) {
          // 查找匹配的队列数据
          const matchedQueueItem = aQueueRes.data.find(
            (item) =>
              item.queueName + item.queueNum === fromSiteCode &&
              item.trayInfo &&
              item.trayInfo !== '' &&
              item.trayStatus === '2' // 已送至2楼缓存区的状态
          );
          
          if (matchedQueueItem) {
            queueDataToProcess = matchedQueueItem;
            console.log(
              `找到队列数据：托盘${matchedQueueItem.trayInfo}，目的地${matchedQueueItem.mudidi}`
            );
          }
        }
        
        // 2. 如果是A区发到c1或c2，先发送解绑接口
        if (
          fromSiteCode.startsWith('A') &&
          (targetPosition === 'c1' || targetPosition === 'c2')
        ) {
          const stationId = this.convertToStationId(targetPosition);
          console.log(`A区发到${targetPosition}，先发送解绑接口：${stationId}`);

          const unbindSuccess = await this.sendAgvUnbindCommand(stationId);
          if (!unbindSuccess) {
            console.log(`AGV解绑失败，但将继续发送AGV指令`);
            uni.showToast({
              title: 'AGV解绑失败，但将继续发送AGV指令',
              icon: 'none'
            });
          } else {
            console.log(`AGV解绑成功：${stationId}`);
          }
        }
        
        // 3. 发送AGV指令
        const robotTaskCode = await this.sendAgvCommand(
          taskType,
          fromSiteCode,
          toSiteCode
        );
        
        if (robotTaskCode && robotTaskCode !== '') {
          // 4. 如果有队列数据，一起处理队列数据
          if (queueDataToProcess) {
            await this.updateQueueDataWithAgvTask(
              queueDataToProcess,
              robotTaskCode,
              targetPosition
            );
          } else {
            console.log(`AGV指令发送成功，任务码：${robotTaskCode}`);
            uni.showToast({
              title: 'AGV指令发送成功',
              icon: 'success'
            });
          }
        } else {
          console.log('AGV指令发送失败');
          uni.showToast({
            title: 'AGV指令发送失败',
            icon: 'none'
          });
        }
      } catch (error) {
        console.error(`处理AGV发送和队列数据时出错：${error.message}`);
        uni.showToast({
          title: `处理AGV发送和队列数据时出错：${error.message}`,
          icon: 'none'
        });
      }
    },
    
    // 更新队列数据与AGV任务关联 - 与PC端逻辑完全一致
    async updateQueueDataWithAgvTask(queueItem, robotTaskCode, targetPosition) {
      try {
        // 获取目标机械臂位置的固定ID
        const targetId = this.robotAreaIdMap[targetPosition];
        
        if (!targetId) {
          console.log(`未找到目标位置${targetPosition}的ID映射`);
          uni.showToast({
            title: `未找到目标位置${targetPosition}的ID映射`,
            icon: 'none'
          });
          return;
        }
        
        // 更新队列数据状态
        const updateParams = [
          {
            id: queueItem.id,
            trayStatus: '23', // 送往机械臂目的地，正在等待AGV取货
            robotTaskCode: robotTaskCode,
            targetPosition: targetPosition,
            targetId: targetId
          },
          {
            id: targetId, // 给目标机械手位置上锁
            isLock: '1'
          }
        ];
        
        const res = await request.post('/queue_info/updateByList', updateParams);
        if (res.code === '200' && res.data == 1) {
          console.log(
            `已为${targetPosition}位置发送AGV送货任务，托盘：${queueItem.trayInfo}，并锁定机械手队列`
          );
          uni.showToast({
            title: `已为${targetPosition}位置自动调度托盘${queueItem.trayInfo}`,
            icon: 'success'
          });
        } else {
          console.log(`队列数据更新失败`);
          uni.showToast({
            title: '队列数据更新失败',
            icon: 'none'
          });
        }
      } catch (error) {
        console.error(`更新队列数据失败：${error.message}`);
        uni.showToast({
          title: `更新队列数据失败：${error.message}`,
          icon: 'none'
        });
      }
    },
    
    // ============ WebSocket和报警日志相关方法 ============
    // 初始化WebSocket连接
    initWebSocket() {
      this.wsClient = new AlarmWebSocketClient({
        workshop: '2800', // 2800车间
        onConnected: this.onWebSocketConnected,
        onDisconnected: this.onWebSocketDisconnected,
        onAlarmReceived: this.onAlarmReceived,
        onError: this.onWebSocketError
      });
      
      this.wsClient.connect();
    },

    // WebSocket连接成功
    onWebSocketConnected() {
      console.log('WebSocket连接成功');
      this.wsStatus.isConnected = true;
      uni.showToast({
        title: '连接服务器成功',
        icon: 'success',
        duration: 2000
      });
    },

    // WebSocket连接断开
    onWebSocketDisconnected() {
      console.log('WebSocket连接断开');
      this.wsStatus.isConnected = false;
      uni.showToast({
        title: '服务器连接断开',
        icon: 'none',
        duration: 2000
      });
    },

    // 收到报警消息
    onAlarmReceived(alarmLog) {
      // 添加到本地报警列表
      this.alarmLogs.unshift(alarmLog);
      // 保持日志数量在合理范围内
      if (this.alarmLogs.length > 100) {
        this.alarmLogs.pop();
      }
      // 显示通知
      uni.showToast({
        title: `报警: ${alarmLog.message}`,
        icon: 'error',
        position: 'top'
      });
      // 震动提醒（需要用户交互后才能生效）
      this.tryVibrate();
    },

    // WebSocket错误
    onWebSocketError(error) {
      console.error('WebSocket错误:', error);
      this.wsStatus.isConnected = false;
    },

    // 切换报警日志弹窗
    toggleAlarmModal() {
      this.showAlarmModal = !this.showAlarmModal;
    },

    // 刷新报警日志
    refreshAlarmLogs() {
      if (this.wsClient) {
        const status = this.wsClient.getConnectionStatus();
        this.wsStatus.isConnected = status.isConnected;
        this.alarmLogs = this.wsClient.getAlarmLogs();
      }
      
      uni.showToast({
        title: '刷新完成',
        icon: 'success',
        duration: 1000
      });
    },

    // 标记单个报警为已读
    markAlarmAsRead(alarm) {
      alarm.unread = false;
      
      // 同步到WebSocket客户端
      if (this.wsClient) {
        const clientAlarms = this.wsClient.getAlarmLogs();
        const clientAlarm = clientAlarms.find(a => a.id === alarm.id);
        if (clientAlarm) {
          clientAlarm.unread = false;
        }
      }
    },

    // 标记所有报警为已读
    markAllAlarmsAsRead() {
      this.alarmLogs.forEach(alarm => {
        alarm.unread = false;
      });
      
      // 同步到WebSocket客户端
      if (this.wsClient) {
        this.wsClient.markAlarmsAsRead();
      }
      
      uni.showToast({
        title: '已全部标记为已读',
        icon: 'success',
        duration: 1000
      });
    },

    // 清空所有报警日志
    clearAllAlarms() {
      uni.showModal({
        title: '确认清空',
        content: '确定要清空所有报警日志吗？',
        success: (res) => {
          if (res.confirm) {
            this.alarmLogs = [];
            
            // 同步到WebSocket客户端
            if (this.wsClient) {
              this.wsClient.clearAlarmLogs();
            }
            
            uni.showToast({
              title: '已清空报警日志',
              icon: 'success',
              duration: 1000
            });
          }
        }
      });
    },

    // 格式化报警时间
    formatAlarmTime(timestamp) {
      if (!timestamp) return '--';
      const date = new Date(timestamp);
      
      // 手动格式化时分秒，避免时区信息显示
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      
      return `${hours}:${minutes}:${seconds}`;
    },

    // 尝试震动提醒（处理浏览器用户激活策略）
    tryVibrate() {
      try {
        // 检查是否支持震动
        if (typeof uni.vibrateLong === 'function') {
          uni.vibrateLong();
        }
      } catch (error) {
        // 静默处理震动失败（通常是因为缺少用户交互）
        console.log('震动提醒被浏览器阻止，需要用户交互后才能生效');
      }
    },

    // === 扫码组件相关方法 ===
    // 打开扫码弹窗
    openScanModal(callback) {
      this.scanCallback = callback;
      this.showScanModal = true;
    },
    
    // 关闭扫码弹窗
    handleScanClose() {
      this.showScanModal = false;
      this.scanCallback = null;
    },
    
    // 确认扫码结果
    handleScanConfirm(scanCode) {
      this.showScanModal = false;
      if (this.scanCallback && typeof this.scanCallback === 'function') {
        this.scanCallback(scanCode);
      }
      this.scanCallback = null;
    },

    // === 新增：上货扫码相关方法 ===
    // 点击上货扫码按钮
    handleScanCode() {
      // 使用PDA扫码组件
      this.openScanModal((scanCode) => {
        // 扫码成功后，获取托盘信息
        this.getTrayInfo(scanCode);
      });
    },
    
    // 获取托盘信息（复制自电脑端FloorFirst.vue）
    getTrayInfo(trayCode) {
      const params = {
        traceid: trayCode.trim(),
        zt: 'N',
        chejian: '2800'
      };
      
      uni.showLoading({
        title: '查询托盘信息...'
      });
      
      request.post('/order_info/selectList', params)
        .then((res) => {
          if (res.code === '200' && res.data && res.data.length > 0) {
            console.log(`读取托盘成功：${JSON.stringify(res.data)}`);
            // 处理扫码后托盘逻辑
            this.dealScanCode(trayCode, res.data[0]);
          } else {
            uni.showToast({
              title: `读取托盘失败：${trayCode}，请检查托盘是否存在`,
              icon: 'none'
            });
          }
        })
        .catch((err) => {
          uni.showToast({
            title: '查询托盘失败，请重试',
            icon: 'none'
          });
          console.error(`读取托盘失败：${trayCode}，请检查托盘是否存在`, err);
        })
        .finally(() => {
          uni.hideLoading();
        });
    },
    
    // 处理扫码后托盘逻辑（复制自电脑端FloorFirst.vue）
    dealScanCode(trayCode, wmsInfo) {
      // 判断目的地队列
      // 如果wmsInfo.mudidi为'2800-1'，进入C队列
      // 如果wmsInfo.mudidi为'2800-2'，进入A队列
      // 如果wmsInfo.mudidi为'2800-3'，进入B队列
      let queueName = '';
      if (wmsInfo.mudidi === '2800-1') {
        queueName = 'C';
      } else if (wmsInfo.mudidi === '2800-2') {
        queueName = 'A';
      } else if (wmsInfo.mudidi === '2800-3') {
        queueName = 'B';
      } else if (
        wmsInfo.mudidi === '2800-2801' ||
        wmsInfo.mudidi === '2800-2802' ||
        wmsInfo.mudidi === '2800-2803' ||
        wmsInfo.mudidi === '2800-2804'
      ) {
        queueName = 'A';
      } else {
        uni.showToast({
          title: `托盘入库失败：${trayCode}，目的地为${wmsInfo.mudidi}，不支持的入库目的地`,
          icon: 'none'
        });
        return;
      }
      
      // 查询队列空闲位置
      request.post('/queue_info/queryQueueList', {
        queueName
      })
        .then(async (res) => {
          if (res.code === '200' && res.data && res.data.length > 0) {
            // 查找第一个空闲的托盘位置
            const emptyPosition = res.data.find(
              (item) =>
                (item.trayInfo === null || item.trayInfo === '') &&
                item.isLock !== '1'
            );
            
            if (emptyPosition) {
              // 说明有空缓存位置，根据托盘信息给AGV小车发送指令
              uni.showLoading({
                title: '发送AGV指令...'
              });
              
              const robotTaskCode = await this.sendAgvCommand(
                'PF-FMR-COMMON-JH1',
                '102',
                emptyPosition.queueName + emptyPosition.queueNum
              );
              
              if (robotTaskCode !== '') {
                // 更新托盘信息
                const param = {
                  id: emptyPosition.id,
                  trayInfo: trayCode,
                  trayStatus: '0',
                  robotTaskCode,
                  trayInfoAdd: wmsInfo.descrC,
                  mudidi: wmsInfo.mudidi
                };
                
                request.post('/queue_info/update', param)
                  .then((updateRes) => {
                    if (updateRes.code === '200' && updateRes.data == 1) {
                      uni.showToast({
                        title: '托盘已入库',
                        icon: 'success'
                      });
                      
                      console.log(
                        `托盘已入库：${trayCode}, 缓存区位置：${emptyPosition.queueName}${emptyPosition.queueNum}`
                      );
                      
                      // 回更WMS信息
                      request.post('/order_info/update', {
                        uuid: wmsInfo.uuid,
                        zt: 'Y'
                      })
                        .then(() => {
                          console.log(`已回更WMS信息成功`);
                        })
                        .catch((err) => {
                          console.log(`托盘入库成功，回更WMS信息失败：${err}`);
                        });
                      
                      // 刷新数据
                      this.fetchQueueData();
                    } else {
                      uni.showToast({
                        title: '托盘入库失败，请重试',
                        icon: 'none'
                      });
                    }
                  })
                  .catch((err) => {
                    uni.showToast({
                      title: '托盘入库失败，请重试',
                      icon: 'none'
                    });
                    console.error(`托盘入库失败：${trayCode},${err}`);
                  });
              }
              
              uni.hideLoading();
            } else {
              uni.showToast({
                title: '缓存区没有空闲位置',
                icon: 'none'
              });
              console.log(`${trayCode} 托盘入库失败，缓存区没有空闲位置`);
            }
          } else {
            uni.showToast({
              title: '查询队列失败',
              icon: 'none'
            });
          }
        })
        .catch((err) => {
          uni.showToast({
            title: '查询队列失败',
            icon: 'none'
          });
          console.error('查询队列托盘情况失败:', err);
        });
    },
    
    // AGV托盘绑定
    async sendAgvBindCommand(slotCode) {
      const params = {
        carrierCategory: 'PALLET',
        carrierType: '2',
        colCount: 1,
        invoke: 'BIND',
        slotCategory: 'SITE',
        slotCode: slotCode,
        temporary: 1
      };
      console.log(`发送AGV绑定指令: 位置=${slotCode}`);
      try {
        const res = await requestAgv.post(
          '/rcs/rtas/api/robot/controller/site/bind',
          params
        );
        if (res.code === 'SUCCESS') {
          console.log(`AGV绑定成功: 位置${slotCode}`);
          return true;
        } else {
          const errorMsg = res.message || '未知错误';
          console.error(`AGV绑定失败: ${errorMsg}`);
          return false;
        }
      } catch (err) {
        console.error('发送AGV绑定指令失败:', err);
        return false;
      }
    },
    
    // AGV托盘解绑
    async sendAgvUnbindCommand(slotCode) {
      const params = {
        carrierCategory: 'PALLET',
        carrierType: '2',
        colCount: 1,
        invoke: 'UNBIND',
        slotCategory: 'SITE',
        slotCode: slotCode,
        temporary: 1
      };
      console.log(`发送AGV解绑指令: 位置=${slotCode}`);
      try {
        const res = await requestAgv.post(
          '/rcs/rtas/api/robot/controller/site/bind',
          params
        );
        if (res.code === 'SUCCESS') {
          console.log(`AGV解绑成功: 位置${slotCode}`);
          return true;
        } else {
          const errorMsg = res.message || '未知错误';
          console.error(`AGV解绑失败: ${errorMsg}`);
          return false;
        }
      } catch (err) {
        console.error('发送AGV解绑指令失败:', err);
        return false;
      }
    },
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
      
      .scan-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #8b5cf6;
        border-radius: 8rpx;
        padding: 6rpx 16rpx;
        margin-left: 8rpx;
        gap: 4rpx;
        
        .scan-icon {
          font-size: 20rpx;
          color: #ffffff;
        }
        
        .scan-text {
          font-size: 24rpx;
          color: #ffffff;
          font-weight: 500;
          white-space: nowrap;
        }
        
        &:active {
          background-color: #7c3aed;
        }
      }
      
      .refresh-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #2563eb;
        border-radius: 8rpx;
        padding: 6rpx 16rpx;
        margin-left: 8rpx;
        
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
      position: relative;
      
      &.is-locked {
        position: relative;
      }
      
      // 锁定遮层样式
      .lock-overlay {
        position: absolute;
        top: 100rpx; // 跳过标题区域的高度
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        border-radius: 0 0 16rpx 16rpx; // 只有底部圆角
        transition: all 0.3s ease;
        
        .lock-content {
          display: flex;
          align-items: center;
          gap: 24rpx;
          color: #fff;
          font-size: 28rpx;
          font-weight: 500;
          
          .lock-icon {
            font-size: 48rpx;
            color: #e6a23c;
          }
          
          .lock-text {
            font-size: 28rpx;
            color: #fff;
            text-align: center;
            line-height: 1.4;
          }
        }
      }
      
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
    padding-top: 60rpx;
    box-sizing: border-box;

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

  // AGV任务管理悬浮按钮样式
  .fab-btn {
    position: fixed;
    right: 30rpx;
    bottom: 100rpx;
    width: 100rpx;
    height: 100rpx;
    background-color: #2563eb;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.2);
    z-index: 999;
    color: #fff;
    font-size: 22rpx;

    .fab-text {
      line-height: 1.2;
    }

    &:active {
      background-color: #1d4ed8;
    }
  }

  // 新增AGV调度悬浮按钮样式
  .agv-schedule-fab {
    bottom: 220rpx; // 调整位置，使其不与原按钮重叠
    background-color: #10b981; // 不同颜色以区分
     &:active {
      background-color: #059669;
    }
  }

  // 报警日志悬浮按钮样式
  .alarm-fab {
    bottom: 340rpx; // 调整位置，使其不与其他按钮重叠
    background-color: #f59e0b; // 报警橙色
    
    &:active {
      background-color: #d97706;
    }
    
    // 脉冲效果 - 只在有未读报警时显示
    &.has-unread-alarms::before {
      content: '';
      position: absolute;
      top: -6rpx;
      left: -6rpx;
      right: -6rpx;
      bottom: -6rpx;
      background-color: #ef4444;
      border-radius: 50%;
      opacity: 0;
      animation: alarm-pulse 2s infinite;
      z-index: -1;
    }
    
    .alarm-badge {
      position: absolute;
      top: -10rpx;
      right: -10rpx;
      background: #ef4444;
      color: #fff;
      font-size: 20rpx;
      border-radius: 50%;
      min-width: 36rpx;
      height: 36rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      font-weight: 600;
      border: 2rpx solid #fff;
      box-shadow: 0 2rpx 8rpx rgba(239, 68, 68, 0.4);
    }
  }
  
  // 脉冲动画
  @keyframes alarm-pulse {
    0% {
      opacity: 0;
      transform: scale(1);
    }
    50% {
      opacity: 0.3;
      transform: scale(1.2);
    }
    100% {
      opacity: 0;
      transform: scale(1.4);
    }
  }

  // AGV任务管理弹窗样式
  .agv-task-modal-content {
    width: 90%;
    max-width: 700rpx;
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    max-height: calc(80vh - 60rpx);
  }

  .agv-task-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20rpx 24rpx;
    border-bottom: 1px solid #f3f4f6;
  }

  .agv-task-modal-tabs {
    display: flex;
    gap: 16rpx;
    flex-grow: 1;

    .agv-task-tab-item {
      padding: 12rpx 16rpx;
      font-size: 26rpx;
      color: #666;
      border-radius: 8rpx;
      transition: all 0.2s ease;

      &.active {
        color: #2563eb;
        background: rgba(37, 99, 235, 0.1);
        font-weight: 500;
      }
      &:active {
        background: rgba(0,0,0,0.05);
      }
    }
  }

  .agv-task-refresh-btn {
    padding: 10rpx 20rpx;
    background-color: #2563eb;
    color: white;
    border-radius: 8rpx;
    font-size: 24rpx;
    margin-left: 16rpx;

    .refresh-text.refreshing {
      opacity: 0.7;
    }
     &:active {
      background-color: #1d4ed8;
    }
  }
  
  /* 刷新状态条样式 */
  .refresh-status-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #eff6ff;
    padding: 10rpx 0;
    border-bottom: 1px solid #bfdbfe;
    color: #1d4ed8;
    font-size: 24rpx;
  }
  
  .refresh-status-text {
    margin-left: 10rpx;
  }
  
  .small-spinner {
    width: 30rpx;
    height: 30rpx;
    border-width: 3rpx;
  }

  .agv-task-modal-body {
    height: calc(80vh - 220rpx); // 80vh (parent) - approx header & footer height (e.g. 100rpx + 120rpx)
    overflow-y: hidden; 
    display: flex; 
    flex-direction: column;
  }

  .agv-task-list {
    height: 100%;
  }
  
  .agv-task-list-inner-content {
    padding: 24rpx; 
    padding-bottom: 48rpx;
    background-color: #f7f8fa;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .scroll-bottom-spacer {
    height: 70rpx;
    flex-shrink: 0;
  }

  .modal-loading-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
    background-color: rgba(255, 255, 255, 0.9);
    border-radius: 12rpx;
    padding: 20rpx 40rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
  }
  
  .modal-empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .agv-task-card {
    background-color: #ffffff;
    border-radius: 16rpx;
    padding: 28rpx;
    margin-bottom: 24rpx;
    box-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.06);
    border: 1px solid #eef2f7;
    transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;

    &:last-child {
      margin-bottom: 0;
    }

    .agv-task-card-row {
      display: flex;
      align-items: flex-start;
      margin-bottom: 18rpx;
      font-size: 28rpx;

      &:last-child {
        margin-bottom: 0;
      }

      .agv-task-label {
        color: #8896b3;
        width: 160rpx;
        flex-shrink: 0;
        font-weight: 400;
      }

      .agv-task-value {
        color: #344054;
        flex: 1;
        word-break: break-all;
        font-weight: 500;
        line-height: 1.5;
         
        &.product-name { 
            color: #1d2939;
            line-height: 1.4;
        }
      }
       .status-text { 
            padding: 4rpx 12rpx;
            border-radius: 20rpx;
            font-size: 24rpx;
            font-weight: 500;
            display: inline-block;

            &.status-waiting { 
              color: #c27803; 
              background-color: #fffbeb; 
              border: 1px solid #fde68a;
            }
            &.status-moving { 
              color: #1d4ed8; 
              background-color: #eff6ff; 
              border: 1px solid #bfdbfe;
            }
        }
    }

    .action-row {
      align-items: center;
      margin-top: 24rpx;
      padding-top: 20rpx;
      border-top: 1px dashed #dde4ee;
    }
    
    .agv-task-actions {
      flex: 1;
      display: flex;
      justify-content: flex-start; 
    }

    .waiting-cancel-text {
      color: #b91c1c;
      font-size: 26rpx;
      font-style: normal;
      font-weight: 500;
      padding: 10rpx 0;
    }

    .cancel-task-btn {
      background-color: #fee2e2;
      color: #b91c1c;
      padding: 12rpx 24rpx;
      border-radius: 8rpx;
      font-size: 26rpx;
      font-weight: 500;
      border: 1px solid #fecaca;
      transition: background-color 0.2s ease, color 0.2s ease;

      &:active {
        background-color: #fecaca;
        color: #991b1b;
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
        
        &.confirm {
          background: #2563eb;
          color: #fff;
          
          &:active {
            background: #1d4ed8;
          }
        }
      }
    }

  // 新增: AGV调度模态框样式
  .agv-schedule-modal-content {
    width: 90%;
    max-width: 700rpx;
    background: #ffffff; // 使用纯白背景，更简洁
    border-radius: 24rpx; // 增大圆角
    overflow: hidden;
    box-shadow: 0 8rpx 30rpx rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    max-height: calc(80vh - 60rpx); // 调整高度，留出更多空间
    padding: 40rpx; // 统一内边距
    box-sizing: border-box;

    .agv-schedule-modal-header {
      font-size: 36rpx; // 增大标题字号
      font-weight: 600;
      color: #1f2937;
      text-align: center;
      margin-bottom: 40rpx; // 增大与内容区的间距
    }

    .agv-schedule-modal-body {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      gap: 30rpx; // 增大输入组之间的间距

      .schedule-input-group {
        display: flex;
        flex-direction: column;
        gap: 12rpx; // 标签与输入框的间距
        
        .schedule-label {
          font-size: 30rpx; // 增大标签字号
          color: #374151;
        }
        .schedule-input {
          border: 1px solid #d1d5db;
          border-radius: 12rpx; // 增大输入框圆角
          padding: 24rpx 24rpx; // 调整内边距，使文字更居中，避免遮挡
          font-size: 30rpx; // 增大输入文字字号
          width: 100%;
          box-sizing: border-box;
          height: 90rpx; // 固定高度以保证视觉一致性
          line-height: normal; // 确保文字垂直居中，对于input，通常normal即可
        }
      }
    }

    .agv-schedule-modal-footer {
      display: flex;
      flex-direction: column; 
      margin-top: 40rpx; // 增大与内容区的间距

      .schedule-btn {
        // flex: 1; // 移除flex:1, 让按钮根据内容自适应宽度，若要等宽，需其他方式
        text-align: center;
        padding: 28rpx 0; // 增大按钮垂直内边距
        font-size: 32rpx; // 增大按钮文字字号
        font-weight: 500;
        border-radius: 12rpx; // 增大按钮圆角
        color: #fff;
        margin-bottom: 24rpx; // 使用 margin-bottom 实现间距

        &:last-child {
          margin-bottom: 0; // 最后一个按钮移除下外边距
        }

        &.single-exec-btn {
          background: #2563eb;
          &:active { background: #1d4ed8; }
        }
        
        &.cycle-exec-btn {
          background: #f59e0b; 
          &:active { background: #d97706; }
        }
        
        &.stop-cycle-btn {
           background: #ef4444; 
           &:active { background: #dc2626; }
        }

        &.close-btn {
          background: #6b7280; 
           &:active { background: #4b5563; }
        }
      }
    }
  }

  // 报警日志弹窗样式
  .alarm-modal-content {
    width: 90%;
    max-width: 700rpx;
    height: 80vh;
    background: #ffffff;
    border-radius: 16rpx;
    overflow: hidden;
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    color: #333;
  }

  .alarm-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24rpx;
    background: #f8f9fa;
    border-bottom: 1px solid #e9ecef;
    flex-shrink: 0;

    .alarm-modal-title {
      font-size: 32rpx;
      font-weight: 600;
      color: #1f2937;
    }

    .alarm-actions {
      display: flex;
      align-items: center;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 8rpx;
      padding: 6rpx 12rpx;
      border-radius: 12rpx;
      background: #f3f4f6;
      font-size: 22rpx;
      margin-right: 16rpx;

      .status-dot {
        width: 12rpx;
        height: 12rpx;
        border-radius: 50%;
        display: block;
      }

      &.connected .status-dot {
        background: #10b981;
      }

      &.disconnected .status-dot {
        background: #ef4444;
      }

      .status-text {
        color: #6b7280;
        font-weight: 500;
      }
    }

    .alarm-refresh-btn {
      background: #2563eb;
      color: #fff;
      padding: 8rpx 16rpx;
      border-radius: 8rpx;
      font-size: 22rpx;
      font-weight: 500;

      &:active {
        background: #1d4ed8;
      }
    }
  }

  .alarm-modal-body {
    flex: 1;
    overflow: hidden;
    background: #f8f9fa;
    display: flex;
    flex-direction: column;
  }

  .alarm-list {
    flex: 1;
    padding: 16rpx;
    box-sizing: border-box;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .alarm-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80rpx 40rpx;
    text-align: center;
    height: 100%;
    box-sizing: border-box;

    .empty-icon {
      font-size: 80rpx;
      margin-bottom: 20rpx;
      color: #9ca3af;
    }

    .empty-text {
      font-size: 28rpx;
      font-weight: 500;
      color: #6b7280;
      margin-bottom: 12rpx;
    }

    .empty-desc {
      font-size: 24rpx;
      color: #9ca3af;
      line-height: 1.5;
    }
  }

  .alarm-card {
    background: #ffffff;
    border: 1rpx solid #e5e7eb;
    border-radius: 12rpx;
    padding: 20rpx;
    margin-bottom: 16rpx;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
    position: relative;
    width: 100%;
    box-sizing: border-box;

    &:last-child {
      margin-bottom: 0;
    }

    &.unread {
      background: #fef2f2;
      border-color: #fecaca;
      box-shadow: 0 2rpx 8rpx rgba(239, 68, 68, 0.1);

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4rpx;
        background: #ef4444;
        border-radius: 0 2rpx 2rpx 0;
      }
    }

    &:active {
      background: #f9fafb;
    }

    .alarm-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12rpx;

      .alarm-source {
        font-size: 22rpx;
        color: #374151;
        background: #f3f4f6;
        padding: 4rpx 8rpx;
        border-radius: 8rpx;
        font-weight: 500;
        white-space: nowrap;
        flex-shrink: 0;
        max-width: 150rpx;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .alarm-time {
        font-size: 22rpx;
        color: #9ca3af;
        font-weight: 400;
        white-space: nowrap;
        flex-shrink: 0;
      }
    }

    .alarm-message {
      font-size: 26rpx;
      color: #1f2937;
      line-height: 1.5;
      font-weight: 500;
      margin-bottom: 8rpx;
      word-wrap: break-word;
      word-break: break-all;
      white-space: normal;
      overflow-wrap: break-word;
    }

    .unread-indicator {
      text-align: right;

      .unread-text {
        font-size: 20rpx;
        color: #ef4444;
        background: #fee2e2;
        padding: 2rpx 8rpx;
        border-radius: 8rpx;
        font-weight: 500;
      }
    }
  }

  .alarm-modal-footer {
    padding: 20rpx 24rpx;
    background: #ffffff;
    border-top: 1px solid #e5e7eb;
    flex-shrink: 0;

    .alarm-footer-actions {
      display: flex;

      .alarm-btn {
        flex: 1;
        text-align: center;
        padding: 16rpx 0;
        font-size: 26rpx;
        font-weight: 500;
        border-radius: 8rpx;
        color: #fff;
        margin-right: 12rpx;
        
        &:last-child {
          margin-right: 0;
        }

        &.clear-btn {
          background: #ef4444;

          &:active {
            background: #dc2626;
          }
        }

        &.mark-read-btn {
          background: #10b981;

          &:active {
            background: #059669;
          }
        }

        &.close-btn {
          background: #6b7280;

          &:active {
            background: #4b5563;
          }
        }
      }
    }
  }
}
</style> 