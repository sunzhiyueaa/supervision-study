// utils/date.js - 日期格式化工具

/**
 * 格式化日期
 * @param {Date} date - 日期对象
 * @param {string} format - 格式字符串，支持 YYYY MM DD M D
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date, format) {
  if (!(date instanceof Date)) {
    date = new Date(date)
  }
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  const map = {
    'YYYY': year,
    'MM': String(month).padStart(2, '0'),
    'DD': String(day).padStart(2, '0'),
    'M': month,
    'D': day
  }

  let result = format
  // 先替换长标记再替换短标记，避免误替换
  result = result.replace('YYYY', map['YYYY'])
  result = result.replace('MM', map['MM'])
  result = result.replace('DD', map['DD'])
  result = result.replace('M', map['M'])
  result = result.replace('D', map['D'])

  return result
}

/**
 * 获取星期几的中文名
 * @param {Date} date - 日期对象
 * @returns {string} 星期几
 */
function getWeekday(date) {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return weekdays[date.getDay()]
}

/**
 * 获取当天的日期字符串 YYYY-MM-DD
 * @returns {string}
 */
function getToday() {
  return formatDate(new Date(), 'YYYY-MM-DD')
}

/**
 * 获取本周的日期列表（周一到周日）
 * @returns {Array} 包含每日信息的数组
 */
function getWeekDays() {
  const today = new Date()
  const dayOfWeek = today.getDay() || 7 // 周日转为7
  const monday = new Date(today)
  monday.setDate(today.getDate() - dayOfWeek + 1)

  const weekdays = ['一', '二', '三', '四', '五', '六', '日']
  const result = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    result.push({
      label: weekdays[i],
      dateStr: formatDate(d, 'M/D'),
      fullDate: formatDate(d, 'YYYY-MM-DD'),
      checkedIn: false
    })
  }

  return result
}

/**
 * 计算两个日期之间的天数差
 * @param {string} date1 - YYYY-MM-DD
 * @param {string} date2 - YYYY-MM-DD
 * @returns {number}
 */
function daysBetween(date1, date2) {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffTime = Math.abs(d2 - d1)
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

module.exports = {
  formatDate,
  getWeekday,
  getToday,
  getWeekDays,
  daysBetween
}
