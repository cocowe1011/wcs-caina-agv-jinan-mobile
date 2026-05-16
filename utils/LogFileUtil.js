/**
 * 移动端日志文件工具模块
 * 使用 uni-app 标准文件系统 API（plus.io）进行日志存储
 * 兼容安卓9和安卓11系统，使用应用私有目录避免权限问题
 * 
 * 日志目录: _doc/wcs_logs/
 * 文件命名: {workshop}_{date}.log（如 2800_2025-05-07.log）
 * 日志格式: [2025-05-07 14:30:25] [运行日志] 消息内容
 * 缓冲机制: 10条或5秒自动刷新
 * 文件轮转: 单文件超过5MB自动轮转
 */

const LOG_BASE_DIR = '_doc/wcs_logs'
const BUFFER_SIZE = 10
const FLUSH_INTERVAL = 5000
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

class LogFileUtil {
  constructor() {
    this.logDir = LOG_BASE_DIR
    this.logBuffer = {} // { workshop: [logEntry, ...] }
    this.logBufferTimer = null
    this.dirEntry = null
    this.initialized = false
    this.writeQueues = {} // 按车间串行落盘，避免并发 FileWriter 冲突
  }

  static instance = null

  static getInstance() {
    if (!LogFileUtil.instance) {
      LogFileUtil.instance = new LogFileUtil()
    }
    return LogFileUtil.instance
  }

  /**
   * 初始化日志目录
   */
  initLogDir() {
    return new Promise((resolve, reject) => {
      // #ifdef APP-PLUS
      if (this.dirEntry) {
        resolve(this.dirEntry)
        return
      }
      plus.io.resolveLocalFileSystemURL(
        '_doc/',
        (docEntry) => {
          docEntry.getDirectory(
            'wcs_logs',
            { create: true },
            (dirEntry) => {
              this.dirEntry = dirEntry
              this.initialized = true
              resolve(dirEntry)
            },
            (error) => {
              console.error('创建日志目录失败:', error)
              reject(error)
            }
          )
        },
        (error) => {
          console.error('解析文档目录失败:', error)
          reject(error)
        }
      )
      // #endif
      // #ifndef APP-PLUS
      console.warn('LogFileUtil: 非APP环境，日志文件功能不可用')
      reject(new Error('非APP环境'))
      // #endif
    })
  }

  /**
   * 写入日志（带缓冲）
   * @param {string} workshop - 车间标识，如 '2800' 或 '2500'
   * @param {string} message - 日志消息
   * @param {string} type - 日志类型: 'running' 或 'alarm'
   */
  writeLog(workshop, message, type = 'running') {
    // #ifdef APP-PLUS
    const timestamp = this._formatTimestamp(new Date())
    const logTypeText = type === 'running' ? '运行日志' : '报警日志'
    const logEntry = `[${timestamp}] [${logTypeText}] ${message}\n`

    if (!this.logBuffer[workshop]) {
      this.logBuffer[workshop] = []
    }
    this.logBuffer[workshop].push(logEntry)

    // 缓冲区满时立即刷新
    if (this.logBuffer[workshop].length >= BUFFER_SIZE) {
      this.flushLogBuffer(workshop)
    } else if (!this.logBufferTimer) {
      // 设置定时刷新
      this.logBufferTimer = setTimeout(() => {
        this.flushAllLogBuffers()
      }, FLUSH_INTERVAL)
    }
    // #endif
  }

  /**
   * 刷新指定车间的日志缓冲区
   */
  flushLogBuffer(workshop) {
    if (!this.logBuffer[workshop] || this.logBuffer[workshop].length === 0) return

    const logContent = this.logBuffer[workshop].join('')
    this.logBuffer[workshop] = []

    this._appendToFile(workshop, logContent)
  }

  /**
   * 刷新所有车间的日志缓冲区
   */
  flushAllLogBuffers() {
    Object.keys(this.logBuffer).forEach((workshop) => {
      this.flushLogBuffer(workshop)
    })

    if (this.logBufferTimer) {
      clearTimeout(this.logBufferTimer)
      this.logBufferTimer = null
    }
  }

  /**
   * 按车间串行执行落盘任务，避免同一文件并发 FileWriter
   */
  _enqueueFileWrite(workshop, writeTask) {
    // #ifdef APP-PLUS
    const prev = this.writeQueues[workshop] || Promise.resolve()
    this.writeQueues[workshop] = prev
      .then(() => writeTask())
      .catch((error) => {
        console.error(`[${workshop}] 日志写入失败:`, error)
      })
    // #endif
  }

  /**
   * 追加内容到日志文件（入队后异步执行）
   */
  _appendToFile(workshop, content) {
    // #ifdef APP-PLUS
    this._enqueueFileWrite(workshop, () => this._appendToFileTask(workshop, content))
    // #endif
  }

  /**
   * 单次落盘：必要时轮转后重新获取 fileEntry，再按 file.size 追加
   */
  _appendToFileTask(workshop, content) {
    const fileName = `${workshop}_${this._formatDate(new Date())}.log`

    return this.initLogDir()
      .then((dirEntry) => this._resolveLogFileEntry(dirEntry, fileName))
      .then(({ dirEntry, fileEntry, fileSize }) => {
        if (fileSize > MAX_FILE_SIZE) {
          return this._rotateLogFile(dirEntry, fileName, workshop).then(() =>
            this._resolveLogFileEntry(dirEntry, fileName)
          )
        }
        return { fileEntry, fileSize }
      })
      .then(({ fileEntry, fileSize }) => this._writeFileContent(fileEntry, content, fileSize))
      .catch((error) => {
        console.error('追加日志文件失败:', error)
        throw error
      })
  }

  /**
   * 获取（或创建）当日日志文件及当前大小
   */
  _resolveLogFileEntry(dirEntry, fileName) {
    return new Promise((resolve, reject) => {
      dirEntry.getFile(
        fileName,
        { create: true },
        (fileEntry) => {
          fileEntry.file(
            (file) => resolve({ dirEntry, fileEntry, fileSize: file.size || 0 }),
            (error) => reject(error)
          )
        },
        (error) => reject(error)
      )
    })
  }

  /**
   * 写入文件内容（追加模式，seek 使用 file.size 而非 writer.length）
   */
  _writeFileContent(fileEntry, content, seekPosition) {
    return new Promise((resolve, reject) => {
      fileEntry.createWriter(
        (writer) => {
          writer.onwriteend = () => resolve()
          writer.onerror = (error) => {
            console.error('写入日志失败:', error)
            reject(error)
          }
          writer.seek(seekPosition)
          writer.write(content)
        },
        (error) => {
          console.error('创建文件写入器失败:', error)
          reject(error)
        }
      )
    })
  }

  /**
   * 日志文件轮转（重命名旧文件）
   */
  _rotateLogFile(dirEntry, fileName, workshop) {
    return new Promise((resolve) => {
      // #ifdef APP-PLUS
      const backupName = fileName.replace('.log', `_${Date.now()}.log`)
      dirEntry.getFile(
        fileName,
        { create: false },
        (fileEntry) => {
          fileEntry.moveTo(
            dirEntry,
            backupName,
            () => {
              console.log(`${workshop}车间日志文件已轮转: ${backupName}`)
              resolve()
            },
            (error) => {
              console.error('日志文件轮转失败:', error)
              resolve() // 即使失败也继续
            }
          )
        },
        () => resolve()
      )
      // #endif
      // #ifndef APP-PLUS
      resolve()
      // #endif
    })
  }

  /**
   * 获取日志文件列表
   * @returns {Promise<Array>} 文件信息数组
   */
  getLogFileList() {
    return new Promise((resolve, reject) => {
      // #ifdef APP-PLUS
      this.initLogDir().then((dirEntry) => {
        const reader = dirEntry.createReader()
        reader.readEntries(
          (entries) => {
            const fileList = []
            const promises = []

            entries.forEach((entry) => {
              if (entry.isFile && entry.name.endsWith('.log')) {
                promises.push(
                  new Promise((res) => {
                    entry.file(
                      (file) => {
                        // 从文件名解析车间和日期
                        const match = entry.name.match(/^(\d+)_(\d{4}-\d{2}-\d{2})/)
                        fileList.push({
                          name: entry.name,
                          fullPath: entry.fullPath,
                          size: file.size,
                          sizeText: this._formatFileSize(file.size),
                          lastModified: file.lastModified || file.lastModifiedDate,
                          lastModifiedText: this._formatTimestamp(new Date(file.lastModified || file.lastModifiedDate)),
                          workshop: match ? match[1] : '未知',
                          date: match ? match[2] : '未知',
                          toLocalURL: entry.toLocalURL ? entry.toLocalURL.bind(entry) : null,
                          entry: entry
                        })
                        res()
                      },
                      () => res()
                    )
                  })
                )
              }
            })

            Promise.all(promises).then(() => {
              // 默认按日期降序排列
              fileList.sort((a, b) => {
                if (a.date !== b.date) {
                  return b.date.localeCompare(a.date)
                }
                return b.name.localeCompare(a.name)
              })
              resolve(fileList)
            })
          },
          (error) => {
            console.error('读取日志目录失败:', error)
            reject(error)
          }
        )
      }).catch(reject)
      // #endif
      // #ifndef APP-PLUS
      resolve([])
      // #endif
    })
  }

  /**
   * 读取日志文件内容
   * @param {string} fileName - 文件名
   * @param {number} maxLines - 最大读取行数（0表示全部）
   * @returns {Promise<string>} 文件内容
   */
  readLogFile(fileName, maxLines = 0) {
    return new Promise((resolve, reject) => {
      // #ifdef APP-PLUS
      this.initLogDir().then((dirEntry) => {
        dirEntry.getFile(
          fileName,
          { create: false },
          (fileEntry) => {
            fileEntry.file(
              (file) => {
                const reader = new plus.io.FileReader()
                reader.onloadend = (e) => {
                  let content = e.target.result || ''
                  if (maxLines > 0 && content) {
                    const lines = content.split('\n')
                    content = lines.slice(-maxLines).join('\n')
                  }
                  resolve(content)
                }
                reader.onerror = (error) => {
                  console.error('读取日志文件失败:', error)
                  reject(error)
                }
                reader.readAsText(file, 'utf-8')
              },
              (error) => {
                console.error('获取日志文件失败:', error)
                reject(error)
              }
            )
          },
          (error) => {
            console.error('文件不存在:', fileName)
            reject(error)
          }
        )
      }).catch(reject)
      // #endif
      // #ifndef APP-PLUS
      resolve('')
      // #endif
    })
  }

  /**
   * 按文件名搜索日志（不读取文件内容）
   * @param {string} keyword - 搜索关键词
   * @param {string} workshop - 车间筛选（可选，空字符串表示全部）
   * @returns {Promise<Array>} 匹配的文件信息数组
   */
  searchLogFilesByName(keyword, workshop = '') {
    const kw = (keyword || '').trim().toLowerCase()
    if (!kw) {
      return Promise.resolve([])
    }
    return this.getLogFileList().then((fileList) => {
      let list = fileList.filter(f => f.name.toLowerCase().includes(kw))
      if (workshop) {
        list = list.filter(f => f.workshop === workshop)
      }
      return list.sort((a, b) => b.date.localeCompare(a.date))
    })
  }

  /** @deprecated 请使用 searchLogFilesByName */
  searchLogContent(keyword, workshop = '') {
    return this.searchLogFilesByName(keyword, workshop)
  }

  /**
   * 删除日志文件
   * @param {string} fileName - 文件名
   */
  deleteLogFile(fileName) {
    return new Promise((resolve, reject) => {
      // #ifdef APP-PLUS
      this.initLogDir().then((dirEntry) => {
        dirEntry.getFile(
          fileName,
          { create: false },
          (fileEntry) => {
            fileEntry.remove(
              () => {
                console.log('已删除日志文件:', fileName)
                resolve()
              },
              (error) => {
                console.error('删除日志文件失败:', error)
                reject(error)
              }
            )
          },
          (error) => {
            console.error('文件不存在:', fileName)
            reject(error)
          }
        )
      }).catch(reject)
      // #endif
      // #ifndef APP-PLUS
      resolve()
      // #endif
    })
  }

  /**
   * 批量删除旧日志（保留最近N天）
   * @param {number} keepDays - 保留天数
   */
  deleteOldLogs(keepDays = 30) {
    return new Promise((resolve, reject) => {
      // #ifdef APP-PLUS
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - keepDays)
      const cutoffStr = this._formatDate(cutoffDate)

      this.getLogFileList().then((fileList) => {
        const deletePromises = fileList
          .filter(f => f.date < cutoffStr)
          .map(f => this.deleteLogFile(f.name))

        Promise.all(deletePromises).then(() => {
          resolve(fileList.filter(f => f.date < cutoffStr).length)
        }).catch(reject)
      }).catch(reject)
      // #endif
      // #ifndef APP-PLUS
      resolve(0)
      // #endif
    })
  }

  /**
   * 获取日志存储统计信息
   */
  getLogStats() {
    return new Promise((resolve, reject) => {
      // #ifdef APP-PLUS
      this.getLogFileList().then((fileList) => {
        let totalSize = 0
        let workshopCount = {}
        let oldestDate = ''
        let newestDate = ''

        fileList.forEach(f => {
          totalSize += f.size
          workshopCount[f.workshop] = (workshopCount[f.workshop] || 0) + 1
          if (!oldestDate || f.date < oldestDate) oldestDate = f.date
          if (!newestDate || f.date > newestDate) newestDate = f.date
        })

        resolve({
          totalFiles: fileList.length,
          totalSize: totalSize,
          totalSizeText: this._formatFileSize(totalSize),
          workshopCount: workshopCount,
          oldestDate: oldestDate,
          newestDate: newestDate
        })
      }).catch(reject)
      // #endif
      // #ifndef APP-PLUS
      resolve({ totalFiles: 0, totalSize: 0, totalSizeText: '0 B', workshopCount: {}, oldestDate: '', newestDate: '' })
      // #endif
    })
  }

  // ============ 工具方法 ============

  _formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  _formatTimestamp(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    const s = String(date.getSeconds()).padStart(2, '0')
    return `${y}-${m}-${d} ${h}:${min}:${s}`
  }

  _formatFileSize(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

export default LogFileUtil
