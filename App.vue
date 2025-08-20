<script>
	import LogManager from './utils/LogManager.js'
	
	export default {
		onLaunch: function() {
			// 初始化日志管理器
			LogManager.log('应用启动');
			
			// 检查登录状态
			const token = uni.getStorageSync('token');
			if (!token) {
				LogManager.log('未找到登录令牌，跳转到登录页');
				uni.reLaunch({
					url: '/pages/login/login'
				});
			} else {
				LogManager.log('用户已登录');
			}
			
			// 全局错误处理
			uni.onError((error) => {
				LogManager.log(`应用运行时错误: ${error}`);
			});
		},
		onShow: function() {
			LogManager.log('App Show', '2800');
			LogManager.log('应用显示');
		},
		onHide: function() {
			LogManager.log('App Hide', '2800');
			LogManager.log('应用隐藏');
			// 应用隐藏时强制刷新日志缓冲区
			LogManager.forceFlush();
		},
		onError: function(error) {
			console.error('App Error:', error);
			LogManager.log(`应用错误: ${error}`);
		}
	}
</script>

<style>
page {
	background-color: #1a2a6c;
}

/* 页面切换动画 */
.uni-page-head,
.uni-page-body {
	background-color: transparent;
}

.uni-page-body {
	background-color: #f5f7fa;
}

/* 添加页面过渡效果 */
.uni-app--showpage {
	animation: fade-in 0.3s ease;
}

@keyframes fade-in {
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}
</style>
