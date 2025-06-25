import serverConfig from './common.js'

const config = {
  baseUrl: serverConfig.getHttpUrl(),  // 使用公共配置
  // 可选本地调试地址：'http://localhost:7005'
  timeout: 5000
}

// 封装请求方法
const request = (options) => {
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      url: config.baseUrl + options.url,
      timeout: config.timeout,
      success: (res) => {
        resolve(res.data)
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

export default {
  get: (url, data = {}) => {
    return request({
      url,
      method: 'GET',
      data
    })
  },
  post: (url, data = {}) => {
    return request({
      url,
      method: 'POST',
      data
    })
  }
} 