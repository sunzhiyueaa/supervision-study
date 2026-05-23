// pages/checkin/index.js - 练字打卡页
const { callAPI } = require('../../services/api')
const { formatDate } = require('../../utils/date')

// 订阅消息模板ID
const TEMPLATE_ID_REMINDER = 'wUNI9FwYhbLe5rwqn9PdlPdbOPyLG2_GcX_LfzEBGrU'

Page({
  data: {
    todayDate: '',
    checkedIn: false,
    // 本地临时图片路径
    imageList: [],
    // 云端图片URL（已上传的）
    cloudImages: [],
    // 今日打卡记录
    record: null,
    // 上传进度
    uploading: false,
    uploadProgress: 0,
    // 评分信息
    scoreInfo: null,
    // 是否已上传完成（等待评分）
    uploaded: false,
    // confetti 动画
    showConfetti: false,
    // 订阅弹窗
    showSubscribeModal: false,
    todaySubscribed: false
  },

  onLoad() {
    const today = new Date()
    this.setData({
      todayDate: formatDate(today, 'M月D日')
    })
    this.loadTodayRecord()

    // 检查今日是否已订阅
    this.checkTodaySubscribed()
  },

  // 加载今日打卡记录
  async loadTodayRecord() {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await callAPI('getRecords', { type: 'today' })
      if (res && res.code === 0 && res.data && res.data.checkedIn) {
        const record = res.data.record || {}
        this.setData({
          checkedIn: true,
          record: record,
          cloudImages: record.images || (record.photoUrl ? [record.photoUrl] : [])
        })
      }
    } catch (err) {
      console.error('加载今日记录失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 检查今日是否已订阅
  checkTodaySubscribed() {
    const today = formatDate(new Date(), 'YYYY-MM-DD')
    const key = 'subscribeToday_' + today
    const subscribed = wx.getStorageSync(key)
    this.setData({ todaySubscribed: !!subscribed })
  },

  // 添加图片回调
  onAddImage(e) {
    const { allImages } = e.detail
    this.setData({ imageList: allImages })
  },

  // 删除图片回调
  onDeleteImage(e) {
    const { allImages } = e.detail
    this.setData({ imageList: allImages })
  },

  // 提交打卡
  async submitCheckin() {
    if (this.data.uploading) return
    if (this.data.imageList.length === 0) {
      wx.showToast({ title: '请先选择练字照片', icon: 'none' })
      return
    }

    this.setData({ uploading: true, uploadProgress: 0 })

    try {
      // 获取 openid 用于构造云存储路径
      const app = getApp()
      const openid = app.globalData.openid || 'unknown'
      const dateStr = formatDate(new Date(), 'YYYY-MM-DD')
      const cloudUrls = []

      // 逐张上传图片
      for (let i = 0; i < this.data.imageList.length; i++) {
        const filePath = this.data.imageList[i]
        const timestamp = Date.now() + i
        const cloudPath = `calligraphy/${openid}/${dateStr}/${timestamp}.jpg`

        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: filePath
        })

        cloudUrls.push(uploadRes.fileID)

        // 更新上传进度
        this.setData({
          uploadProgress: Math.round(((i + 1) / this.data.imageList.length) * 100)
        })
      }

      this.setData({ cloudImages: cloudUrls, uploaded: true })

      // 调用云函数保存记录
      const res = await callAPI('submitRecord', {
        type: 'checkin',
        images: cloudUrls,
        date: dateStr
      })

      if (res && res.code === 0) {
        // 显示 confetti 庆祝动画
        this.setData({ showConfetti: true })
        setTimeout(() => {
          this.setData({ showConfetti: false })
          // 动画结束后弹出订阅弹窗
          this.checkTodaySubscribed()
          this.setData({ showSubscribeModal: true })
        }, 2500)
        wx.showToast({ title: '打卡成功！', icon: 'success' })
        this.setData({
          checkedIn: true,
          record: res.data || {}
        })
        // 重新加载记录以获取完整数据
        this.loadTodayRecord()
      } else {
        wx.showToast({ title: res.message || '提交失败', icon: 'none' })
      }
    } catch (err) {
      console.error('提交打卡失败', err)
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      this.setData({ uploading: false, uploadProgress: 0 })
    }
  },

  // 获取评分（调用 scoreCalligraphy 云函数）
  async getScore() {
    if (!this.data.cloudImages || this.data.cloudImages.length === 0) {
      wx.showToast({ title: '暂无图片可评分', icon: 'none' })
      return
    }

    wx.showLoading({ title: '评分中...' })
    try {
      const res = await callAPI('scoreCalligraphy', {
        fileID: this.data.cloudImages[0]
      })
      wx.hideLoading()

      if (res && res.code === 0) {
        const scoreData = res.data
        this.setData({ scoreInfo: scoreData })

        // 将评分结果更新到数据库记录
        await callAPI('submitRecord', {
          type: 'updateScore',
          date: formatDate(new Date(), 'YYYY-MM-DD'),
          score: scoreData.totalScore,
          comment: scoreData.comment || '',
          breakdown: scoreData.breakdown || {},
          ocrText: scoreData.ocrText || ''
        })

        // 同步更新 record 显示
        this.setData({
          'record.score': scoreData.totalScore,
          'record.comment': scoreData.comment || ''
        })

        wx.showToast({ title: '评分完成', icon: 'success' })
      } else {
        wx.showToast({ title: '评分服务暂未开放', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('获取评分失败', err)
      wx.showToast({ title: '评分失败，稍后重试', icon: 'none' })
    }
  },

  // 预览图片
  previewImage(e) {
    const current = e.currentTarget.dataset.src
    wx.previewImage({
      current: current,
      urls: this.data.cloudImages
    })
  },

  // 执行订阅
  doSubscribe() {
    wx.requestSubscribeMessage({
      tmplIds: [TEMPLATE_ID_REMINDER],
      success: (res) => {
        if (res[TEMPLATE_ID_REMINDER] === 'accept') {
          // 本地标记今日已订阅
          const today = formatDate(new Date(), 'YYYY-MM-DD')
          const key = 'subscribeToday_' + today
          wx.setStorageSync(key, true)
          this.setData({ todaySubscribed: true })

          // 同步到云端
          callAPI('submitRecord', {
            type: 'updateSubscribeDate',
            subscribedDate: today
          }).catch(err => {
            console.error('更新订阅日期失败', err)
          })

          wx.showToast({ title: '订阅成功', icon: 'success' })
        } else {
          wx.showToast({ title: '您已拒绝订阅', icon: 'none' })
        }
      },
      fail: (err) => {
        console.error('订阅消息失败', err)
        wx.showToast({ title: '订阅失败，请稍后重试', icon: 'none' })
      }
    })
  },

  // 关闭订阅弹窗
  closeSubscribeModal() {
    this.setData({ showSubscribeModal: false })
  }
})
