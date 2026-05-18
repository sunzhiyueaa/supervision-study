// pages/settings/index.js - 设置页
const { callAPI } = require('../../services/api')
const { getUserInfo } = require('../../utils/auth')

// 订阅消息模板ID占位符（需在微信后台申请后替换）
const TEMPLATE_ID_REMINDER = 'TEMPLATE_ID_REMINDER'

Page({
  data: {
    reminderEnabled: false,
    reminderTime: '20:00',
    userInfo: {},
    totalCheckins: 0,
    totalPoints: 0,
    registerDays: 0,
    saving: false
  },

  onLoad() {
    this.loadSettings()
  },

  // 加载设置
  async loadSettings() {
    try {
      const userInfo = await getUserInfo()
      if (userInfo) {
        this.setData({
          userInfo: userInfo,
          reminderEnabled: userInfo.reminderEnabled || false,
          reminderTime: userInfo.reminderTime || '20:00',
          totalPoints: userInfo.totalPoints || 0
        })

        // 计算注册天数
        if (userInfo.createdAt) {
          const regDate = new Date(userInfo.createdAt)
          const now = new Date()
          const days = Math.ceil((now - regDate) / (1000 * 60 * 60 * 24))
          this.setData({ registerDays: days })
        }
      }

      // 获取打卡天数
      const res = await callAPI('getRecords', { type: 'stats' })
      if (res && res.code === 0) {
        this.setData({
          totalCheckins: res.data.totalCheckins || 0
        })
      }
    } catch (err) {
      console.error('加载设置失败', err)
    }
  },

  // 切换提醒开关
  async toggleReminder(e) {
    const enabled = e.detail.value
    this.setData({ reminderEnabled: enabled })

    if (enabled) {
      // 开启提醒时引导订阅
      this.requestSubscribe()
    }

    try {
      await callAPI('submitRecord', {
        type: 'updateSettings',
        reminderEnabled: enabled
      })
      wx.showToast({ title: enabled ? '已开启提醒' : '已关闭提醒', icon: 'none' })
    } catch (err) {
      console.error('更新提醒设置失败', err)
      // 回滚状态
      this.setData({ reminderEnabled: !enabled })
    }
  },

  // 修改提醒时间
  async onTimeChange(e) {
    const time = e.detail.value
    this.setData({ reminderTime: time })

    try {
      await callAPI('submitRecord', {
        type: 'updateSettings',
        reminderTime: time
      })
      wx.showToast({ title: '提醒时间已更新', icon: 'none' })
    } catch (err) {
      console.error('更新提醒时间失败', err)
    }
  },

  // 请求订阅消息授权
  requestSubscribe() {
    wx.requestSubscribeMessage({
      tmplIds: [TEMPLATE_ID_REMINDER],
      success: (res) => {
        if (res[TEMPLATE_ID_REMINDER] === 'accept') {
          wx.showToast({ title: '订阅成功', icon: 'success' })
        } else {
          wx.showToast({ title: '您已拒绝订阅，将无法收到提醒', icon: 'none' })
        }
      },
      fail: (err) {
        console.error('订阅消息失败', err)
        wx.showToast({ title: '订阅失败，请稍后重试', icon: 'none' })
      }
    })
  },

  // 点击订阅按钮
  subscribeReminder() {
    this.requestSubscribe()
  },

  // 修改昵称
  editNickname() {
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入新昵称',
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            await callAPI('submitRecord', {
              type: 'updateProfile',
              nickname: res.content
            })
            this.setData({ 'userInfo.nickname': res.content })

            // 更新本地缓存
            const app = getApp()
            if (app.globalData.userInfo) {
              app.globalData.userInfo.nickname = res.content
              wx.setStorageSync('userInfo', app.globalData.userInfo)
            }

            wx.showToast({ title: '修改成功', icon: 'success' })
          } catch (err) {
            console.error('修改昵称失败', err)
          }
        }
      }
    })
  },

  // 保存所有设置
  async saveSettings() {
    if (this.data.saving) return
    this.setData({ saving: true })

    try {
      await callAPI('submitRecord', {
        type: 'updateSettings',
        reminderEnabled: this.data.reminderEnabled,
        reminderTime: this.data.reminderTime
      })
      wx.showToast({ title: '设置已保存', icon: 'success' })
    } catch (err) {
      console.error('保存设置失败', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
