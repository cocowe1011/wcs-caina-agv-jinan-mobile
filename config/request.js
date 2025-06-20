const config = {
  baseUrl: process.env.NODE_ENV === 'development' 
    ? 'http://192.168.1.9:7005'  // 开发环境
	// ? 'http://localhost:7005'
    : 'http://10.120.50.99:7005', // 生产环境
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