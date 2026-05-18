// components/calendar/calendar.js - 日历组件
// 支持三种状态标记：completed(绿色)、missed(红色)、none(无标记)
const { formatDate } = require('../../utils/date')

Component({
  properties: {
    // 年份
    year: {
      type: Number,
      value: new Date().getFullYear()
    },
    // 月份
    month: {
      type: Number,
      value: new Date().getMonth() + 1
    },
    // 打卡记录数组，格式 [{date:'2026-05-01', status:'completed'|'missed'|'none'}]
    records: {
      type: Array,
      value: []
    }
  },

  data: {
    weekLabels: ['日', '一', '二', '三', '四', '五', '六'],
    currentMonth: '',
    dateGrid: []
  },

  lifetimes: {
    attached() {
      this.buildGrid()
    }
  },

  observers: {
    'year, month, records': function () {
      this.buildGrid()
    }
  },

  methods: {
    // 构建日期网格
    buildGrid() {
      const { year, month, records } = this.data
      this.setData({ currentMonth: `${year}年${month}月` })

      const firstDay = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0)
      const startWeekday = firstDay.getDay()
      const totalDays = lastDay.getDate()
      const todayStr = formatDate(new Date(), 'YYYY-MM-DD')

      // 构建记录查找表
      const recordMap = {}
      ;(records || []).forEach(r => {
        recordMap[r.date] = r.status
      })

      const grid = []

      // 上月填充
      const prevLast = new Date(year, month - 1, 0).getDate()
      for (let i = startWeekday - 1; i >= 0; i--) {
        grid.push({
          day: prevLast - i,
          isCurrentMonth: false,
          isToday: false,
          status: '',
          dateStr: ''
        })
      }

      // 当月
      for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const status = recordMap[dateStr] || 'none'
        grid.push({
          day: d,
          isCurrentMonth: true,
          isToday: dateStr === todayStr,
          status: status,
          dateStr
        })
      }

      // 下月填充
      const remaining = grid.length <= 35 ? 35 - grid.length : 42 - grid.length
      for (let i = 1; i <= remaining; i++) {
        grid.push({
          day: i,
          isCurrentMonth: false,
          isToday: false,
          status: '',
          dateStr: ''
        })
      }

      this.setData({ dateGrid: grid })
    },

    // 上一月
    prevMonth() {
      let { year, month } = this.data
      month--
      if (month < 1) { month = 12; year-- }
      this.setData({ year, month })
      this.triggerEvent('monthchange', { year, month })
    },

    // 下一月
    nextMonth() {
      let { year, month } = this.data
      month++
      if (month > 12) { month = 1; year++ }
      this.setData({ year, month })
      this.triggerEvent('monthchange', { year, month })
    },

    // 点击日期
    onDateTap(e) {
      const dateStr = e.currentTarget.dataset.date
      if (dateStr) {
        this.triggerEvent('dayclick', { date: dateStr })
      }
    }
  }
})
