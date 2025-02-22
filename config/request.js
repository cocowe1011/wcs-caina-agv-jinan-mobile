const config = {
  baseUrl: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:7005'  // 开发环境
    : 'http://your-prod-api-domain/api', // 生产环境
  timeout: 20000
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