const config = {
  baseUrl: process.env.NODE_ENV === 'development' 
    ? 'http://10.120.50.3'  // 开发环境
    : 'http://10.120.50.3', // 生产环境
  timeout: 5000
}

// 封装请求方法
const request = (options) => {
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      url: config.baseUrl + options.url,
      timeout: config.timeout,
      header: {
        ...options.header,
        'X-LR-REQUEST-ID': Date.now().toString()
      },
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