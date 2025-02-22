// #ifndef VUE3
import Vue from 'vue'
import App from './App'

Vue.config.productionTip = false

// 全局错误处理
Vue.config.errorHandler = function(err, vm, info) {
  console.error('Vue错误:', err);
  uni.showToast({
    title: '系统错误，请重试',
    icon: 'none'
  });
}

App.mpType = 'app'

const app = new Vue({
    ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
import App from './App.vue'
export function createApp() {
  const app = createSSRApp(App)
  return {
    app
  }
}
// #endif