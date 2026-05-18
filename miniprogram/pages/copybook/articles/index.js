// pages/copybook/articles/index.js - 素材文章列表
const copybookService = require('../../../services/copybook')

Page({
  data: {
    articles: [],
    categories: ['时政金句', '人生哲理', '文学之美', '励志名言', '英语佳句'],
    currentCategory: '',
    keyword: '',
    page: 1,
    hasMore: true,
    loading: false,
    initialized: false,
    // 添加素材弹窗
    showAddModal: false,
    addForm: {
      source: '',
      title: '',
      content: '',
      tags: '自定义'
    }
  },

  onLoad() {
    this.checkAndInit()
  },

  onShow() {
    if (this.data.initialized) {
      this.loadArticles()
    }
  },

  // 检查是否需要初始化默认素材
  async checkAndInit() {
    try {
      // 先尝试加载文章，如果为空则初始化
      const res = await copybookService.getArticles({ page: 1, pageSize: 1 })
      if (res && res.code === 0 && res.total === 0) {
        // 数据库为空，初始化默认素材
        wx.showLoading({ title: '加载素材中...' })
        await copybookService.initArticles()
        wx.hideLoading()
      }
      this.setData({ initialized: true })
      this.loadArticles()
    } catch (err) {
      console.error('检查初始化失败', err)
      this.setData({ initialized: true })
      this.loadArticles()
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true })
    this.loadArticles().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 触底加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore()
    }
  },

  // 加载文章列表
  async loadArticles() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const res = await copybookService.getArticles({
        category: this.data.currentCategory || undefined,
        keyword: this.data.keyword || undefined,
        page: 1
      })
      if (res && res.code === 0) {
        const articles = (res.data || []).map(item => this.formatArticle(item))
        this.setData({
          articles: articles,
          page: 1,
          hasMore: res.hasMore || false
        })
      }
    } catch (err) {
      console.error('加载文章列表失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 格式化文章数据
  formatArticle(item) {
    const source = item.source || '未知来源'
    const tags = item.tags || []
    return {
      ...item,
      sourceName: source,
      // 来源颜色：人民日报红色，半月谈蓝色，英语佳句橙色，其他灰色
      sourceType: source === '人民日报' ? 'red' :
                  source === '半月谈' ? 'blue' :
                  source === '英语佳句' ? 'orange' : 'gray',
      tagText: tags.length > 0 ? tags[0] : '',
      charCountText: item.charCount ? item.charCount + '字' : ''
    }
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  // 确认搜索
  onSearchConfirm() {
    this.loadArticles()
  },

  // 清空搜索
  onSearchClear() {
    this.setData({ keyword: '' })
    this.loadArticles()
  },

  // 设置分类
  setCategory(e) {
    const cat = e.currentTarget.dataset.cat
    this.setData({ currentCategory: cat })
    this.loadArticles()
  },

  // 加载更多
  async loadMore() {
    if (this.data.loading) return
    const nextPage = this.data.page + 1
    this.setData({ loading: true })

    try {
      const res = await copybookService.getArticles({
        category: this.data.currentCategory || undefined,
        keyword: this.data.keyword || undefined,
        page: nextPage
      })
      if (res && res.code === 0) {
        const newArticles = (res.data || []).map(item => this.formatArticle(item))
        this.setData({
          articles: [...this.data.articles, ...newArticles],
          page: nextPage,
          hasMore: res.hasMore || false
        })
      }
    } catch (err) {
      console.error('加载更多失败', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 跳转字帖生成
  goToGenerate(e) {
    const article = e.currentTarget.dataset.article
    // 将文章内容传递给生成页
    wx.navigateTo({
      url: `/pages/copybook/generate/index?articleId=${article._id}&content=${encodeURIComponent(article.content)}&source=${encodeURIComponent(article.sourceName)}`
    })
  },

  // 打开添加素材弹窗
  openAddModal() {
    this.setData({
      showAddModal: true,
      addForm: { source: '', title: '', content: '', tags: '自定义' }
    })
  },

  // 关闭添加素材弹窗
  closeAddModal() {
    this.setData({ showAddModal: false })
  },

  // 添加表单输入
  onAddFormInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`addForm.${field}`]: e.detail.value })
  },

  // 提交添加素材
  async submitAddArticle() {
    const { source, title, content, tags } = this.data.addForm
    if (!title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    if (!content.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '添加中...' })
      const res = await copybookService.addArticle({
        source: source || '自定义',
        title: title,
        content: content,
        tags: tags ? [tags] : ['自定义']
      })
      wx.hideLoading()

      if (res && res.code === 0) {
        wx.showToast({ title: '添加成功', icon: 'success' })
        this.setData({ showAddModal: false })
        this.loadArticles()
      } else {
        wx.showToast({ title: res.message || '添加失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('添加素材失败', err)
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  },

  // 阻止冒泡
  preventBubble() {}
})
