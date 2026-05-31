// utils/logger.js - 轻量级日志工具
const config = require('../config')

const LOG_LEVELS = { info: 0, warn: 1, error: 2 }
const MIN_LEVEL = config.mode === 'prod' ? LOG_LEVELS.info : LOG_LEVELS.warn

let _db = null
function getDB() {
  if (!_db) _db = wx.cloud.database()
  return _db
}

function log(level, message, data) {
  if (LOG_LEVELS[level] < MIN_LEVEL) return

  const pages = getCurrentPages()
  const page = pages.length > 0 ? pages[pages.length - 1].route : 'unknown'

  const entry = {
    level,
    message,
    data: data || null,
    page,
    createTime: new Date(),
  }

  // 异步写入，不阻塞
  getDB().collection('logs').add({ data: entry }).catch(() => {})
}

module.exports = {
  info: (msg, data) => log('info', msg, data),
  warn: (msg, data) => log('warn', msg, data),
  error: (msg, data) => log('error', msg, data),
}
