// pages/calendar/index.js - 日历记录+统计
const { callAPI } = require('../../services/api')
const { formatDate } = require('../../utils/date')

Page({
  data: {
    // 当前年月
    year: 0,
    month: 0,
    // 日历记录数据 [{date, status}]
    records: [],
    // 月度统计
    monthCheckins: 0,
    monthTotalDays: 0,
    completionRate: 0,
    avgScore: 0,
    streakDays: 0,
    // 选中日期
    selectedDate: '',
    // 选中日期的详情
    dayDetail: null,
    // 加载状态
    loading: false
  },

  onLoad() {
    const now = new Date()
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth() + 1
    })
    this.loadMonthData()
  },

  // 加载月份数据（打卡状态 + 统计）
  async loadMonthData() {
    this.setData({ loading: true })
    const { year, month } = this.data

    try {
      // 并行请求月度记录和统计数据
      const [monthRes, statsRes] = await Promise.all([
        callAPI('getRecords', { type: 'month', year, month }),
        callAPI('getRecords', { type: 'stats', year, month })
      ])

      // 处理月度打卡记录
      let records = []
      if (monthRes && monthRes.code === 0) {
        const checkedDates = monthRes.data.checkedDates || []
        records = this.buildRecordsFromChecked(year, month, checkedDates)
      }

      // 处理统计数据
      let monthCheckins = 0
      let completionRate = 0
      let avgScore = 0
      let streakDays = 0
      if (statsRes && statsRes.code === 0) {
        monthCheckins = statsRes.data.monthCheckins || 0
        avgScore = statsRes.data.avgScore || 0
        streakDays = statsRes.data.streakDays || 0
        const totalDays = statsRes.data.monthTotalDays || new Date(year, month, 0).getDate()
        completionRate = totalDays > 0 ? Math.round(monthCheckins / totalDays * 100) : 0
      }

      // 计算当月应完成天数（截至今天，未来日期不算）
      const now = new Date()
      const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
      const monthTotalDays = isCurrentMonth
        ? now.getDate()
        : new Date(year, month, 0).getDate()

      this.setData({
        records,
        monthCheckins,
        monthTotalDays,
        completionRate,
        avgScore,
        streakDays,
        loading: false,
        // 清空选中日期详情
        selectedDate: '',
        dayDetail: null
      })
    } catch (err) {
      console.error('加载月份数据失败', err)
      this.setData({ loading: false })
    }
  },

  // 将 checkedDates 数组转换为 records 格式
  buildRecordsFromChecked(year, month, checkedDates) {
    const records = []
    const totalDays = new Date(year, month, 0).getDate()
    const now = new Date()
    const todayStr = formatDate(now, 'YYYY-MM-DD')

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      // 只标记过去的日期（今天及之前）
      if (dateStr <= todayStr) {
        if (checkedDates.includes(dateStr)) {
          records.push({ date: dateStr, status: 'completed' })
        } else {
          records.push({ date: dateStr, status: 'missed' })
        }
      } else {
        records.push({ date: dateStr, status: 'none' })
      }
    }
    return records
  },

  // 月份切换
  onMonthChange(e) {
    const { year, month } = e.detail
    this.setData({ year, month })
    this.loadMonthData()
  },

  // 点击日期
  async onDayClick(e) {
    const dateStr = e.detail.date
    if (!dateStr) return

    this.setData({ selectedDate: dateStr, dayDetail: null })

    try {
      const res = await callAPI('getRecords', { type: 'day', date: dateStr })
      if (res && res.code === 0) {
        const dayRecords = res.data.records || []
        // 获取当天错题数量
        const mistakeRes = await callAPI('getRecords', { type: 'day', date: dateStr, includeMistakes: true })
        const mistakeCount = (mistakeRes && mistakeRes.code === 0 && mistakeRes.data.mistakeCount) || 0

        if (dayRecords.length > 0) {
          const record = dayRecords[0]
          this.setData({
            dayDetail: {
              photoUrl: record.photoUrl || '',
              score: record.score || 0,
              comment: record.comment || '',
              breakdown: record.breakdown || null,
              ocrText: record.ocrText || '',
              mistakeCount,
              completedAt: record.createdAt || ''
            }
          })
        } else {
          this.setData({ dayDetail: null })
        }
      }
    } catch (err) {
      console.error('加载日期记录失败', err)
    }
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url
    if (url) {
      wx.previewImage({
        current: url,
        urls: [url]
      })
    }
  }
})
