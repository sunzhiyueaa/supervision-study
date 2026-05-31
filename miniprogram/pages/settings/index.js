// pages/settings/index.js - 设置页
const { callAPI } = require('../../services/api')
const { getUserInfo } = require('../../utils/auth')
const logger = require('../../utils/logger')

// 订阅消息模板ID占位符（需在微信后台申请后替换）
const TEMPLATE_ID_REMINDER = 'wUNI9FwYhbLe5rwqn9PdlPdbOPyLG2_GcX_LfzEBGrU'

Page({
  data: {
    reminderEnabled: false,
    reminderTime: '20:00',
    userInfo: {},
    totalCheckins: 0,
    totalPoints: 0,
    registerDays: 0,
    saving: false,

    // 字体管理
    fontList: [],
    uploadingFont: false
  },

  onLoad() {
    this.loadSettings()
  },

  onShow() {
    logger.info('访问设置页')
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

      // 加载用户字体列表
      this.loadFontList()
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
      fail: (err) => {
        console.error('订阅消息失败', err)
        wx.showToast({ title: '订阅失败，请稍后重试', icon: 'none' })
      }
    })
  },

  // 点击订阅按钮
  subscribeReminder() {
    this.requestSubscribe()
  },

  // 昵称输入失焦
  async onNicknameBlur(e) {
    const nickname = e.detail.value
    if (!nickname || nickname === this.data.userInfo.nickname) return
    try {
      await callAPI('submitRecord', {
        type: 'updateProfile',
        nickname: nickname
      })
      this.setData({ 'userInfo.nickname': nickname })

      const app = getApp()
      if (app.globalData.userInfo) {
        app.globalData.userInfo.nickname = nickname
        wx.setStorageSync('userInfo', app.globalData.userInfo)
      }
    } catch (err) {
      logger.error('修改昵称失败', { err: err.message || err })
    }
  },

  // 头像选择回调
  async onChooseAvatar(e) {
    const tempFilePath = e.detail.avatarUrl
    wx.showLoading({ title: '上传中...' })
    try {
      const openid = getApp().globalData.openid
      const cloudPath = `avatars/${openid}/${Date.now()}.png`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath
      })

      await callAPI('submitRecord', {
        type: 'updateProfile',
        avatar: uploadRes.fileID
      })

      this.setData({ 'userInfo.avatar': uploadRes.fileID })

      const app = getApp()
      if (app.globalData.userInfo) {
        app.globalData.userInfo.avatar = uploadRes.fileID
        wx.setStorageSync('userInfo', app.globalData.userInfo)
      }

      wx.hideLoading()
      wx.showToast({ title: '头像已更新', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      logger.error('上传头像失败', { err: err.message || err })
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
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
      logger.error('保存设置失败', { err: err.message || err })
      console.error('保存设置失败', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  // 加载用户字体列表
  async loadFontList() {
    try {
      const res = await callAPI('getRecords', { type: 'fonts' })
      if (res && res.code === 0) {
        const fontList = (res.data || []).map(item => ({
          ...item,
          fileSizeText: this.formatFileSize(item.fileSize)
        }))
        this.setData({ fontList })
      }
    } catch (err) {
      console.error('加载字体列表失败:', err)
    }
  },

  // 上传字体文件
  uploadFont() {
    if (this.data.uploadingFont) return
    if (this.data.fontList.length >= 5) {
      wx.showToast({ title: '最多上传5个字体', icon: 'none' })
      return
    }

    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['ttf'],
      success: (res) => {
        const file = res.tempFiles[0]
        // 检查文件大小（20MB限制）
        if (file.size > 20 * 1024 * 1024) {
          wx.showToast({ title: '文件不能超过20MB', icon: 'none' })
          return
        }
        this.doUploadFont(file)
      }
    })
  },

  // 执行上传
  async doUploadFont(file) {
    this.setData({ uploadingFont: true })
    wx.showLoading({ title: '上传中...' })

    try {
      const app = getApp()
      const openid = app.globalData.openid
      const fileName = file.name.replace(/\.ttf$/i, '')
      const cloudPath = `fonts/${openid}/${Date.now()}-${file.name}`

      // 上传到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: file.path
      })

      // 记录到数据库
      await callAPI('submitRecord', {
        type: 'addFont',
        fileName,
        fileID: uploadRes.fileID,
        fileSize: file.size
      })

      logger.info('上传字体成功')
      wx.showToast({ title: '上传成功', icon: 'success' })
      this.loadFontList()
    } catch (err) {
      logger.error('上传字体失败', { err: err.message || err })
      console.error('上传字体失败:', err)
      wx.showToast({ title: '上传失败', icon: 'none' })
    } finally {
      this.setData({ uploadingFont: false })
      wx.hideLoading()
    }
  },

  // 删除字体
  deleteFont(e) {
    const { id, fileid, name } = e.currentTarget.dataset
    wx.showModal({
      title: '删除字体',
      content: `确定删除字体"${name}"吗？`,
      success: async (res) => {
        if (!res.confirm) return
        try {
          await callAPI('submitRecord', {
            type: 'deleteFont',
            fontId: id,
            fileID: fileid
          })
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadFontList()
        } catch (err) {
          console.error('删除字体失败:', err)
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + 'B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
  }
})
