<script>
	export default {
		onLaunch: function() {
			// 检查登录状态
			const token = uni.getStorageSync('token');
			if (!token) {
				uni.reLaunch({
					url: '/pages/login/login'
				});
			}
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
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
