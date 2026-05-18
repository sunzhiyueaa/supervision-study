// pages/rewards/index.js - 积分奖励（我的页面）
const { callAPI, getPointsSummary, getPointsHistory } = require('../../services/api')
const { getUserInfo } = require('../../utils/auth')
const { formatDate } = require('../../utils/date')

Page({
  data: {
    userInfo: {},
    totalPoints: 0,
    todayPoints: 0,
    weekPoints: 0,
    streakDays: 0,
    achievements: [],
    pointsLog: [],
    page: 1,
    hasMore: true,
    loading: false
  },

  onLoad() {
    this.loadAllData()
  },

  onShow() {
    this.loadAllData()
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true, pointsLog: [] })
    this.loadAllData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 触底加载更多积分记录
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadPointsHistory()
    }
  },

  // 加载所有数据
  async loadAllData() {
    try {
      // 获取用户信息
      const userInfo = await getUserInfo()
      if (userInfo) {
        this.setData({
          userInfo: {
            nickname: userInfo.nickname || '未设置',
            avatar: userInfo.avatar || ''
          }
        })
      }

      // 获取积分总览
      const summaryRes = await getPointsSummary()
      if (summaryRes && summaryRes.code === 0) {
        this.setData({
          totalPoints: summaryRes.data.totalPoints || 0,
          todayPoints: summaryRes.data.todayPoints || 0,
          weekPoints: summaryRes.data.weekPoints || 0,
          streakDays: summaryRes.data.streakDays || 0,
          achievements: summaryRes.data.achievements || []
        })
      }

      // 加载积分记录（第一页）
      this.setData({ page: 1, pointsLog: [], hasMore: true })
      this.loadPointsHistory()
    } catch (err) {
      console.error('加载积分数据失败', err)
    }
  },

  // 加载积分记录（分页）
  async loadPointsHistory() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const res = await getPointsHistory(this.data.page, 20)
      if (res && res.code === 0) {
        const newGroups = (res.data.list || []).map(group => ({
          date: group.date,
          dateDisplay: this.formatDateDisplay(group.date),
          items: (group.items || []).map(item => ({
            _id: item._id,
            points: item.points,
            description: item.description,
            type: item.type,
            timeStr: this.formatTime(item.createdAt)
          }))
        }))

        this.setData({
          pointsLog: this.data.pointsLog.concat(newGroups),
          page: this.data.page + 1,
          hasMore: res.data.hasMore
        })
      }
    } catch (err) {
      console.error('加载积分记录失败', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 格式化日期显示
  formatDateDisplay(dateStr) {
    const today = formatDate(new Date(), 'YYYY-MM-DD')
    const yesterday = formatDate(new Date(Date.now() - 86400000), 'YYYY-MM-DD')
    if (dateStr === today) return '今天'
    if (dateStr === yesterday) return '昨天'
    const parts = dateStr.split('-')
    return parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日'
  },

  // 格式化时间
  formatTime(dateVal) {
    if (!dateVal) return ''
    const d = new Date(dateVal)
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return h + ':' + m
  },

  // 跳转设置
  goToSettings() {
    wx.navigateTo({ url: '/pages/settings/index' })
  },

  // 跳转错题本
  goToMistakes() {
    wx.navigateTo({ url: '/pages/mistakes/index' })
  }
})
