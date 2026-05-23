// pages/copybook/generate/index.js - 字帖生成
// 使用 Canvas 2D API 实时渲染字帖，支持保存到相册和收藏
const copybookService = require('../../../services/copybook')

Page({
  data: {
    // 文本内容
    text: '',
    articleId: '',
    sourceName: '',
    // 配置选项
    fontStyle: '默认',
    fontStyles: ['默认'],
    userFonts: [],
    gridType: '田字格',
    gridTypes: ['田字格', '米字格', '方格', '横线'],
    fontSize: 'medium',
    fontSizes: ['small', 'medium', 'large'],
    fontSizeLabels: ['小', '中', '大'],
    fontSizeIndex: 1,
    columns: 6,
    columnsOptions: [4, 6, 8],
    columnsIndex: 1,
    // 状态
    layoutData: null,
    generating: false,
    saving: false,
    canvasReady: false,
    tempFilePath: '',
  },

  // Canvas 相关
  canvas: null,
  ctx: null,
  dpr: 1,
  // A4 画布相关
  a4Canvas: null,
  a4Ctx: null,
  // 字体加载状态
  fontsLoaded: false,

  onLoad(options) {
    this.dpr = wx.getWindowInfo().pixelRatio || 2

    let data = {}
    if (options.content) {
      data.text = decodeURIComponent(options.content)
    }
    if (options.articleId) {
      data.articleId = options.articleId
    }
    if (options.source) {
      data.sourceName = decodeURIComponent(options.source)
    }
    // 接收字体和格子类型参数
    if (options.fontStyle) {
      const decoded = decodeURIComponent(options.fontStyle)
      const index = this.data.fontStyles.indexOf(decoded)
      if (index > -1) {
        data.fontStyle = decoded
      }
    }
    if (options.gridType) {
      const decoded = decodeURIComponent(options.gridType)
      if (this.data.gridTypes.indexOf(decoded) > -1) {
        data.gridType = decoded
      }
    }
    if (Object.keys(data).length > 0) {
      this.setData(data)
    }
  },

  onReady() {
    // 页面初次渲染完成时初始化 Canvas
    this.initCanvas()
    this.initA4Canvas()
    this.loadFonts()
  },

  // 初始化 Canvas 2D
  initCanvas() {
    const query = wx.createSelectorQuery()
    query.select('#copybookCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        this.canvas = canvas
        this.ctx = ctx
        this.setData({ canvasReady: true })
      })
  },

  // 初始化 A4 打印画布
  initA4Canvas() {
    const query = wx.createSelectorQuery()
    query.select('#a4Canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        // A4 纸 300DPI: 2480 x 3508 像素
        canvas.width = 2480
        canvas.height = 3508
        this.a4Canvas = canvas
        this.a4Ctx = ctx
      })
  },

  // 加载用户自定义字体
  async loadFonts() {
    try {
      const { callAPI } = require('../../../services/api')
      const res = await callAPI('getRecords', { type: 'fonts' })
      if (res && res.code === 0 && res.data && res.data.length > 0) {
        const userFonts = res.data
        this.setData({ userFonts })

        // 构建字体样式列表
        const fontStyles = ['默认', ...userFonts.map(f => f.fileName)]
        this.setData({ fontStyles })

        // 下载字体文件到本地临时目录，再用本地路径加载
        for (const font of userFonts) {
          try {
            console.log('下载字体文件:', font.fileName, font.fileID)
            const downloadRes = await wx.cloud.downloadFile({
              fileID: font.fileID
            })
            console.log('字体下载成功:', font.fileName, downloadRes.tempFilePath)

            // 用本地临时文件路径加载字体
            wx.loadFontFace({
              family: font.fileName,
              source: `url("${downloadRes.tempFilePath}")`,
              global: true,
              success: () => {
                console.log('字体加载成功:', font.fileName)
              },
              fail: (err) => {
                console.warn('字体加载失败:', font.fileName, JSON.stringify(err))
              }
            })
          } catch (err) {
            console.warn('字体下载失败:', font.fileName, JSON.stringify(err))
          }
        }
      }
      this.fontsLoaded = true
    } catch (err) {
      console.error('加载字体列表失败:', err)
    }
  },

  // 文本输入
  onTextInput(e) {
    this.setData({ text: e.detail.value })
  },

  // 字体样式选择
  onFontStyleChange(e) {
    const index = e.currentTarget.dataset.value
    this.setData({ fontStyle: this.data.fontStyles[index] })
  },

  // 格子类型选择
  onGridTypeSelect(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ gridType: type })
  },

  // 字号选择
  onFontSizeSelect(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      fontSize: this.data.fontSizes[index],
      fontSizeIndex: index
    })
  },

  // 每行字数选择
  onColumnsSelect(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      columns: this.data.columnsOptions[index],
      columnsIndex: index
    })
  },

  // 生成预览（点击按钮触发，确保字体加载完成后再绘制）
  async previewCopybook() {
    if (!this.data.text || !this.data.text.trim()) {
      wx.showToast({ title: '请输入练字内容', icon: 'none' })
      return
    }
    if (!this.data.canvasReady) {
      wx.showToast({ title: '画布未就绪', icon: 'none' })
      return
    }

    wx.showLoading({ title: '生成中...' })

    // 如果字体还没加载，先加载
    if (!this.fontsLoaded) {
      await this.loadFonts()
      // 等待字体资源就绪
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    this.drawCopybook()
    wx.hideLoading()
  },

  // 绘制字帖（核心方法）
  drawCopybook() {
    const { text, gridType, fontSize, columns } = this.data
    if (!text || !text.trim()) return

    const ctx = this.ctx
    const canvas = this.canvas
    if (!ctx || !canvas) return

    // 字号映射到格子大小（逻辑像素）
    const gridSizeMap = { small: 40, medium: 55, large: 70 }
    const gridSize = gridSizeMap[fontSize] || 55

    // 过滤空白字符
    const chars = text.replace(/\s+/g, '').split('')
    const padding = 20
    const rows = Math.ceil(chars.length / columns)

    // 设置 Canvas 尺寸（逻辑像素）
    const canvasW = padding * 2 + columns * gridSize
    const canvasH = padding * 2 + rows * gridSize

    canvas.width = canvasW * this.dpr
    canvas.height = canvasH * this.dpr
    ctx.scale(this.dpr, this.dpr)

    // 设置 Canvas 的 CSS 尺寸（通过 style）
    wx.createSelectorQuery()
      .select('#copybookCanvas')
      .boundingClientRect((rect) => {
        // 不需要额外设置，WXML 中已设置 style
      }).exec()

    // 清空画布
    ctx.clearRect(0, 0, canvasW, canvasH)

    // 绘制白色背景
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasW, canvasH)

    // 1. 绘制格子
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const x = padding + col * gridSize
        const y = padding + row * gridSize
        this.drawGrid(ctx, x, y, gridSize, gridType)
      }
    }

    // 2. 绘制示范字（每个字后留一个空格子供练习）
    const charSize = gridSize * 0.65
    ctx.fillStyle = '#333333'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // 使用自定义字体或默认字体
    let fontFamily
    if (this.data.fontStyle === '默认') {
      fontFamily = 'serif'
    } else {
      fontFamily = `'${this.data.fontStyle}', serif`
    }
    ctx.font = `${charSize}px ${fontFamily}`

    for (let i = 0; i < chars.length; i++) {
      const row = Math.floor(i / columns)
      const col = i % columns
      const cx = padding + col * gridSize + gridSize / 2
      const cy = padding + row * gridSize + gridSize / 2
      ctx.fillStyle = '#333333'
      ctx.fillText(chars[i], cx, cy)
    }

    // 保存布局数据用于后续操作
    this.setData({
      layoutData: {
        width: canvasW,
        height: canvasH,
        gridSize: gridSize,
        rows: rows,
        columns: columns,
        chars: chars
      }
    })
  },

  // 绘制单个格子
  drawGrid(ctx, x, y, size, type) {
    // 外框
    ctx.strokeStyle = '#d0d0d0'
    ctx.lineWidth = 1
    ctx.setLineDash([])
    ctx.strokeRect(x, y, size, size)

    if (type === '田字格') {
      // 十字虚线
      ctx.strokeStyle = '#e8e8e8'
      ctx.lineWidth = 0.5
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      // 垂直中线
      ctx.moveTo(x + size / 2, y)
      ctx.lineTo(x + size / 2, y + size)
      // 水平中线
      ctx.moveTo(x, y + size / 2)
      ctx.lineTo(x + size, y + size / 2)
      ctx.stroke()
      ctx.setLineDash([])
    } else if (type === '米字格') {
      // 十字虚线 + 对角虚线
      ctx.strokeStyle = '#e8e8e8'
      ctx.lineWidth = 0.5
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      // 垂直中线
      ctx.moveTo(x + size / 2, y)
      ctx.lineTo(x + size / 2, y + size)
      // 水平中线
      ctx.moveTo(x, y + size / 2)
      ctx.lineTo(x + size, y + size / 2)
      // 对角线
      ctx.moveTo(x, y)
      ctx.lineTo(x + size, y + size)
      ctx.moveTo(x + size, y)
      ctx.lineTo(x, y + size)
      ctx.stroke()
      ctx.setLineDash([])
    } else if (type === '方格') {
      // 仅外框，无辅助线（已在上面画过）
    } else if (type === '横线') {
      // 横线格式 - 只画底部横线
      ctx.strokeStyle = '#c0c0c0'
      ctx.lineWidth = 1
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(x, y + size)
      ctx.lineTo(x + size, y + size)
      ctx.stroke()
    }
  },

  // 绘制 A4 尺寸字帖（用于打印导出）
  drawA4Copybook() {
    const { text, gridType, fontSize, columns, fontStyle } = this.data
    if (!text || !text.trim()) return
    if (!this.a4Canvas || !this.a4Ctx) return

    const ctx = this.a4Ctx
    const canvas = this.a4Canvas

    // A4 纸 300DPI: 2480 x 3508 像素
    const A4_W = 2480
    const A4_H = 3508
    const MARGIN = 100 // 页边距（像素）

    // 计算可用区域
    const availW = A4_W - MARGIN * 2
    const availH = A4_H - MARGIN * 2

    // 根据列数和可用宽度计算格子大小
    const gridSize = Math.floor(availW / columns)
    const rows = Math.floor(availH / gridSize)

    // 过滤空白字符
    const chars = text.replace(/\s+/g, '').split('')

    // 居中偏移
    const totalW = columns * gridSize
    const actualRows = Math.ceil(chars.length / columns)
    const displayRows = Math.min(actualRows, rows)
    const totalH = displayRows * gridSize
    const offsetX = MARGIN + Math.floor((availW - totalW) / 2)
    const offsetY = MARGIN + Math.floor((availH - totalH) / 2)

    // 清空并绘制白色背景
    ctx.clearRect(0, 0, A4_W, A4_H)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, A4_W, A4_H)

    // 绘制格子
    for (let row = 0; row < displayRows; row++) {
      for (let col = 0; col < columns; col++) {
        const x = offsetX + col * gridSize
        const y = offsetY + row * gridSize
        this.drawGrid(ctx, x, y, gridSize, gridType)
      }
    }

    // 绘制示范字
    const charSize = gridSize * 0.65
    ctx.fillStyle = '#333333'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let fontFamily
    if (fontStyle === '默认') {
      fontFamily = 'serif'
    } else {
      fontFamily = `'${fontStyle}', serif`
    }
    ctx.font = `${charSize}px ${fontFamily}`

    for (let i = 0; i < chars.length && Math.floor(i / columns) < rows; i++) {
      const row = Math.floor(i / columns)
      const col = i % columns
      const cx = offsetX + col * gridSize + gridSize / 2
      const cy = offsetY + row * gridSize + gridSize / 2
      ctx.fillStyle = '#333333'
      ctx.fillText(chars[i], cx, cy)
    }
  },

  // 从 A4 画布导出临时文件
  a4CanvasToTempFile() {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas: this.a4Canvas,
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      })
    })
  },

  // 生成并保存到相册
  async generateAndSave() {
    if (!this.data.text || !this.data.text.trim()) {
      wx.showToast({ title: '请输入练字内容', icon: 'none' })
      return
    }

    // 先确保绘制了最新内容
    this.drawCopybook()

    this.setData({ saving: true })
    try {
      // 1. 绘制 A4 尺寸字帖并导出
      this.drawA4Copybook()
      const tempFilePath = await this.a4CanvasToTempFile()
      this.setData({ tempFilePath: tempFilePath })

      // 2. 保存到相册
      await this.saveToAlbum(tempFilePath)

      // 3. 调用云函数保存生成记录
      await copybookService.generateCopybook({
        text: this.data.text,
        fontStyle: this.data.fontStyle,
        gridType: this.data.gridType,
        fontSize: this.data.fontSize,
        columns: this.data.columns,
        articleId: this.data.articleId
      })

      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (err) {
      console.error('保存失败:', err)
      if (err.errMsg && err.errMsg.indexOf('auth deny') > -1) {
        wx.showModal({
          title: '需要授权',
          content: '请允许保存图片到相册',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) wx.openSetting()
          }
        })
      } else {
        wx.showToast({ title: '保存失败，请重试', icon: 'none' })
      }
    } finally {
      this.setData({ saving: false })
    }
  },

  // Canvas 导出临时文件
  canvasToTempFile() {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas: this.canvas,
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      })
    })
  },

  // 保存到相册
  saveToAlbum(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath: filePath,
        success: resolve,
        fail: reject
      })
    })
  },

  // 添加到收藏（仅保存记录，不保存到相册）
  async addToFavorite() {
    if (!this.data.text || !this.data.text.trim()) {
      wx.showToast({ title: '请输入练字内容', icon: 'none' })
      return
    }

    // 先确保绘制了最新内容
    this.drawCopybook()

    this.setData({ generating: true })
    try {
      const res = await copybookService.generateCopybook({
        text: this.data.text,
        fontStyle: this.data.fontStyle,
        gridType: this.data.gridType,
        fontSize: this.data.fontSize,
        columns: this.data.columns,
        articleId: this.data.articleId
      })

      if (res && res.code === 0) {
        wx.showToast({ title: '已添加到收藏', icon: 'success' })
      } else {
        wx.showToast({ title: res.message || '收藏失败', icon: 'none' })
      }
    } catch (err) {
      console.error('收藏失败:', err)
      wx.showToast({ title: '收藏失败', icon: 'none' })
    } finally {
      this.setData({ generating: false })
    }
  }
})
