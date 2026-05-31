// pages/mistakes/index.js - 错题本记录页
const { callAPI } = require('../../services/api')
const { formatDate, getToday } = require('../../utils/date')
const logger = require('../../utils/logger')

// 科目列表
const SUBJECTS = ['全部', '语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理']
// 错误原因分类
const ERROR_TYPES = ['粗心', '不会', '审题错误', '计算错误']

Page({
  data: {
    // 错题列表
    mistakes: [],
    // 统计
    stats: {
      todayCount: 0,
      weekCount: 0,
      monthCount: 0
    },
    // 科目筛选
    subjects: SUBJECTS,
    currentSubject: '全部',
    // 日期筛选
    filterDate: '',
    // 添加弹窗
    showAddModal: false,
    newMistake: {
      subject: '',
      images: [],
      imageList: [],
      description: '',
      errorType: ''
    },
    // 科目选择弹窗
    showSubjectPicker: false,
    // 错误类型选择弹窗
    showErrorPicker: false,
    errorTypes: ERROR_TYPES,
    // 加载状态
    loading: false,
    // 详情弹窗
    showDetailModal: false,
    detailMistake: null
  },

  onLoad() {
    this.setData({ filterDate: getToday() })
    this.loadMistakes()
  },

  onShow() {
    logger.info('访问错题页')
    this.loadMistakes()
  },

  // 加载错题列表
  async loadMistakes() {
    this.setData({ loading: true })
    try {
      const params = { type: 'mistakes' }
      if (this.data.currentSubject && this.data.currentSubject !== '全部') {
        params.subject = this.data.currentSubject
      }
      if (this.data.filterDate) {
        params.date = this.data.filterDate
      }

      const res = await callAPI('getRecords', params)
      if (res && res.code === 0) {
        const data = res.data || {}
        const list = (data.list || []).map(item => ({
          ...item,
          dateStr: item.date || formatDate(new Date(item.createdAt), 'M月D日'),
          timeStr: item.createdAt ? this.formatTime(item.createdAt) : '',
          // 兼容旧字段
          images: item.images || (item.photoUrl ? [item.photoUrl] : []),
          description: item.description || item.question || ''
        }))

        this.setData({
          mistakes: list,
          stats: data.stats || { todayCount: 0, weekCount: 0, monthCount: 0 }
        })
      }
    } catch (err) {
      console.error('加载错题列表失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 格式化时间
  formatTime(dateVal) {
    try {
      const d = new Date(dateVal)
      const h = String(d.getHours()).padStart(2, '0')
      const m = String(d.getMinutes()).padStart(2, '0')
      return `${h}:${m}`
    } catch (e) {
      return ''
    }
  },

  // 科目筛选
  onSubjectFilter(e) {
    const subject = e.currentTarget.dataset.subject
    this.setData({ currentSubject: subject })
    this.loadMistakes()
  },

  // 日期筛选
  onDateChange(e) {
    this.setData({ filterDate: e.detail.value })
    this.loadMistakes()
  },

  // 清除日期筛选
  clearDateFilter() {
    this.setData({ filterDate: getToday() })
    this.loadMistakes()
  },

  // 打开添加弹窗
  addMistake() {
    this.setData({
      showAddModal: true,
      newMistake: {
        subject: '',
        images: [],
        imageList: [],
        description: '',
        errorType: ''
      }
    })
  },

  // 关闭添加弹窗
  closeModal() {
    this.setData({ showAddModal: false })
  },

  // 打开科目选择
  openSubjectPicker() {
    this.setData({ showSubjectPicker: true })
  },

  // 关闭科目选择
  closeSubjectPicker() {
    this.setData({ showSubjectPicker: false })
  },

  // 选择科目
  onPickSubject(e) {
    const subject = e.currentTarget.dataset.subject
    this.setData({
      'newMistake.subject': subject,
      showSubjectPicker: false
    })
  },

  // 打开错误类型选择
  openErrorPicker() {
    this.setData({ showErrorPicker: true })
  },

  // 关闭错误类型选择
  closeErrorPicker() {
    this.setData({ showErrorPicker: false })
  },

  // 选择错误类型
  onPickError(e) {
    const errorType = e.currentTarget.dataset.error
    this.setData({
      'newMistake.errorType': errorType,
      showErrorPicker: false
    })
  },

  // 添加图片回调
  onAddImage(e) {
    const { allImages } = e.detail
    this.setData({ 'newMistake.imageList': allImages })
  },

  // 删除图片回调
  onDeleteImage(e) {
    const { allImages } = e.detail
    this.setData({ 'newMistake.imageList': allImages })
  },

  // 输入描述
  onDescInput(e) {
    this.setData({ 'newMistake.description': e.detail.value })
  },

  // 保存错题
  async saveMistake() {
    const { subject, imageList, description, errorType } = this.data.newMistake
    if (!subject) {
      wx.showToast({ title: '请选择科目', icon: 'none' })
      return
    }
    if (!description && imageList.length === 0) {
      wx.showToast({ title: '请填写描述或上传图片', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    try {
      // 上传图片
      const cloudImages = []
      for (let i = 0; i < imageList.length; i++) {
        const filePath = imageList[i]
        const timestamp = Date.now() + i
        const cloudPath = `mistakes/${timestamp}.jpg`
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath
        })
        cloudImages.push(uploadRes.fileID)
      }

      const res = await callAPI('submitRecord', {
        type: 'mistake',
        subject: subject,
        images: cloudImages,
        description: description,
        errorType: errorType,
        date: getToday()
      })

      wx.hideLoading()
      if (res && res.code === 0) {
        logger.info('保存错题成功')
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.setData({ showAddModal: false })
        this.loadMistakes()
      } else {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      logger.error('保存错题失败', { err: err.message || err })
      console.error('保存错题失败', err)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

  // 删除错题
  deleteMistake(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这道错题吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' })
            const result = await callAPI('submitRecord', {
              type: 'mistake_delete',
              mistakeId: id
            })
            wx.hideLoading()
            if (result && result.code === 0) {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.setData({ showDetailModal: false, detailMistake: null })
              this.loadMistakes()
            } else {
              wx.showToast({ title: result.message || '删除失败', icon: 'none' })
            }
          } catch (err) {
            wx.hideLoading()
            console.error('删除错题失败', err)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 查看详情
  viewDetail(e) {
    const id = e.currentTarget.dataset.id
    const mistake = this.data.mistakes.find(m => m._id === id)
    if (mistake) {
      this.setData({
        showDetailModal: true,
        detailMistake: mistake
      })
    }
  },

  // 关闭详情
  closeDetail() {
    this.setData({ showDetailModal: false, detailMistake: null })
  },

  // 预览图片
  previewImage(e) {
    const current = e.currentTarget.dataset.src
    const urls = e.currentTarget.dataset.urls || [current]
    wx.previewImage({ current, urls })
  }
})
