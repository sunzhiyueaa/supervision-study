// pages/index/index.js - 首页（今日任务+打卡入口+简要统计）
const { callAPI } = require('../../services/api')
const { checkLogin } = require('../../utils/auth')
const { formatDate, getWeekday, getWeekDays } = require('../../utils/date')

// 订阅消息模板ID占位符（需在微信后台申请后替换）
const TEMPLATE_ID_REMINDER = 'wUNI9FwYhbLe5rwqn9PdlPdbOPyLG2_GcX_LfzEBGrU'

Page({
  data: {
    todayDate: '',
    todayWeekday: '',
    greetingText: '',
    streakDays: 0,
    todayCheckedIn: false,
    todayMistakeCount: 0,
    weekDays: [],
    totalPoints: 0,
    loading: true,
    showSubscribeTip: false
  },

  onLoad() {
    this.initPage()
  },

  onShow() {
    // 每次显示刷新数据（从打卡页返回时更新状态）
    this.loadDashboard()
    // 检查是否需要引导订阅
    this.checkSubscribeTip()
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadDashboard().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 初始化页面
  async initPage() {
    try {
      await checkLogin()
      const today = new Date()
      const hour = today.getHours()
      let greeting = '晚上好'
      if (hour < 6) greeting = '夜深了'
      else if (hour < 12) greeting = '早上好'
      else if (hour < 14) greeting = '中午好'
      else if (hour < 18) greeting = '下午好'
      this.setData({
        todayDate: formatDate(today, 'M月D日'),
        todayWeekday: getWeekday(today),
        greetingText: greeting
      })
      this.loadDashboard()
    } catch (err) {
      console.error('初始化页面失败', err)
    }
  },

  // 加载仪表盘数据
  loadDashboard() {
    return callAPI('getRecords', { type: 'dashboard' }).then(res => {
      if (res && res.code === 0) {
        const data = res.data
        // 生成本周数据
        const weekDays = getWeekDays()
        // 将后端返回的打卡日期与本周日期匹配
        const checkedDates = data.checkedDates || []
        weekDays.forEach(item => {
          item.checkedIn = checkedDates.indexOf(item.fullDate) !== -1
        })

        this.setData({
          streakDays: data.streakDays || 0,
          todayCheckedIn: data.todayCheckedIn || false,
          todayMistakeCount: data.todayMistakeCount || 0,
          totalPoints: data.totalPoints || 0,
          weekDays: weekDays,
          loading: false
        })
      }
    }).catch(err => {
      console.error('加载仪表盘数据失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    })
  },

  // 页面跳转
  goToCheckin() {
    wx.navigateTo({ url: '/pages/checkin/index' })
  },

  goToMistakes() {
    wx.navigateTo({ url: '/pages/mistakes/index' })
  },

  goToArticles() {
    wx.switchTab({ url: '/pages/copybook/articles/index' })
  },

  goToGallery() {
    wx.navigateTo({ url: '/pages/copybook/gallery/index' })
  },

  goToRewards() {
    wx.switchTab({ url: '/pages/rewards/index' })
  },

  goToSettings() {
    wx.navigateTo({ url: '/pages/settings/index' })
  },

  // 检查是否需要引导订阅消息
  checkSubscribeTip() {
    // 判断条件：已登录 + 未关闭过提示 + 未开启提醒
    const app = getApp()
    const userInfo = app.globalData.userInfo
    if (!userInfo) return

    // 如果已开启提醒，不展示引导
    if (userInfo.reminderEnabled) {
      this.setData({ showSubscribeTip: false })
      return
    }

    // 检查今天是否已关闭过提示
    const today = formatDate(new Date(), 'YYYY-MM-DD')
    const dismissedDate = wx.getStorageSync('subscribeTipDismissedDate')
    if (dismissedDate === today) {
      this.setData({ showSubscribeTip: false })
      return
    }

    // 展示订阅引导
    this.setData({ showSubscribeTip: true })
  },

  // 一键开启提醒并订阅
  async enableReminder() {
    try {
      // 先请求订阅授权
      wx.requestSubscribeMessage({
        tmplIds: [TEMPLATE_ID_REMINDER],
        success: async (res) => {
          // 无论是否同意订阅，都开启提醒设置
          await callAPI('submitRecord', {
            type: 'updateSettings',
            reminderEnabled: true,
            reminderTime: '20:00'
          })

          // 更新缓存
          const app = getApp()
          if (app.globalData.userInfo) {
            app.globalData.userInfo.reminderEnabled = true
            app.globalData.userInfo.reminderTime = '20:00'
            wx.setStorageSync('userInfo', app.globalData.userInfo)
          }

          this.setData({ showSubscribeTip: false })
          wx.showToast({ title: '已开启每日提醒', icon: 'success' })
        },
        fail: () => {
          wx.showToast({ title: '订阅失败，可在设置页重新操作', icon: 'none' })
        }
      })
    } catch (err) {
      console.error('开启提醒失败', err)
    }
  },

  // 关闭订阅引导
  dismissSubscribeTip() {
    const today = formatDate(new Date(), 'YYYY-MM-DD')
    wx.setStorageSync('subscribeTipDismissedDate', today)
    this.setData({ showSubscribeTip: false })
  }
})
