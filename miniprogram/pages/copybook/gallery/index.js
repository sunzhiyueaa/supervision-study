// pages/copybook/gallery/index.js - 已生成字帖
const copybookService = require('../../../services/copybook')
const { formatDate } = require('../../../utils/date')
const logger = require('../../../utils/logger')

Page({
  data: {
    copybooks: [],
    loading: false,
    page: 1,
    hasMore: true
  },

  onLoad() {
    this.loadGallery()
  },

  onShow() {
    logger.info('访问字帖收藏页')
    // 每次显示时刷新，以获取最新数据
    this.setData({ page: 1, hasMore: true })
    this.loadGallery()
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true })
    this.loadGallery().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 触底加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore()
    }
  },

  // 加载字帖列表
  async loadGallery() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const res = await copybookService.getMyGallery({ page: 1 })
      if (res && res.code === 0) {
        const copybooks = (res.data || []).map(item => this.formatCopybook(item))
        this.setData({
          copybooks: copybooks,
          page: 1,
          hasMore: res.hasMore || false
        })
      }
    } catch (err) {
      console.error('加载字帖列表失败', err)
      logger.error('加载收藏失败', { err: err.message || err })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载更多
  async loadMore() {
    if (this.data.loading) return
    const nextPage = this.data.page + 1
    this.setData({ loading: true })

    try {
      const res = await copybookService.getMyGallery({ page: nextPage })
      if (res && res.code === 0) {
        const newItems = (res.data || []).map(item => this.formatCopybook(item))
        this.setData({
          copybooks: [...this.data.copybooks, ...newItems],
          page: nextPage,
          hasMore: res.hasMore || false
        })
      }
    } catch (err) {
      console.error('加载更多失败', err)
      logger.error('加载收藏失败', { err: err.message || err })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 格式化字帖数据
  formatCopybook(item) {
    const text = item.text || ''
    return {
      ...item,
      // 取前6个字作为缩略标题
      previewText: text.length > 6 ? text.slice(0, 6) + '...' : text,
      dateStr: item.createdAt ? formatDate(new Date(item.createdAt), 'M月D日') : '',
      // 格子类型标签
      gridTypeLabel: item.gridType || '田字格',
      fontStyleLabel: item.fontStyle || '楷体'
    }
  },

  // 预览大图（重新渲染 Canvas 后保存查看）
  previewCopybook(e) {
    const item = e.currentTarget.dataset.item
    if (!item || !item.text) return

    // 跳转到生成页查看和重新保存
    wx.navigateTo({
      url: `/pages/copybook/generate/index?content=${encodeURIComponent(item.text)}&source=${encodeURIComponent('我的收藏')}`
    })
  },

  // 重新保存到相册（需要重新渲染 Canvas）
  async saveToAlbum(e) {
    const item = e.currentTarget.dataset.item
    if (!item || !item.text) return

    // 跳转到生成页，用户可从那里保存
    wx.navigateTo({
      url: `/pages/copybook/generate/index?content=${encodeURIComponent(item.text)}&source=${encodeURIComponent('我的收藏')}&fontStyle=${encodeURIComponent(item.fontStyle || '楷体')}&gridType=${encodeURIComponent(item.gridType || '田字格')}`
    })
  },

  // 长按删除
  onLongPress(e) {
    const item = e.currentTarget.dataset.item
    if (!item || !item._id) return

    wx.showActionSheet({
      itemList: ['删除该字帖'],
      itemColor: '#f44336',
      success: (res) => {
        if (res.tapIndex === 0) {
          this.confirmDelete(item._id)
        }
      }
    })
  },

  // 确认删除
  confirmDelete(id) {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除吗？',
      confirmColor: '#f44336',
      success: async (res) => {
        if (res.confirm) {
          await this.deleteCopybook(id)
        }
      }
    })
  },

  // 跳转到素材文章页
  goToArticles() {
    wx.switchTab({
      url: '/pages/copybook/articles/index'
    })
  },

  // 删除字帖
  async deleteCopybook(id) {
    try {
      const db = wx.cloud.database()
      await db.collection('copybook_generated').doc(id).remove()
      wx.showToast({ title: '已删除', icon: 'success' })
      // 从列表中移除
      const copybooks = this.data.copybooks.filter(item => item._id !== id)
      this.setData({ copybooks })
    } catch (err) {
      console.error('删除失败:', err)
      logger.error('加载收藏失败', { err: err.message || err })
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  }
})
