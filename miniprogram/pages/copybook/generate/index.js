// pages/copybook/generate/index.js - 字帖生成
// 使用 Canvas 2D API 实时渲染字帖，支持保存到相册和收藏
const copybookService = require('../../../services/copybook')

Page({
  data: {
    // 文本内容
    text: '',
    articleId: '',
    sourceName: '',
    // 来源类型：'course'（课程）或 'daily'（每日素材）
    sourceType: 'course',
    // 配置选项
    fontStyle: '默认',
    fontStyles: ['默认'],
    userFonts: [],
    gridType: '田字格',
    gridTypes: ['田字格', '米字格', '方格', '横线'],
    // 练习模式（仅课程模式）
    practiceMode: 'trace',
    practiceModes: ['描红', '一字一空', '一字一空+额外空行'],
    practiceModeLabels: ['描红', '一字一空', '一字一空+额外空行'],
    // 状态
    layoutData: null,
    generating: false,
    saving: false,
    canvasReady: false,
    tempFilePath: '',
    lessonNo: 0,
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
    if (options.lessonNo) {
      data.lessonNo = parseInt(options.lessonNo)
      data.sourceType = 'course'
    } else {
      data.sourceType = 'daily'
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

  // 练习模式选择
  onPracticeModeSelect(e) {
    const index = e.currentTarget.dataset.index
    const modes = ['trace', 'one-empty', 'one-extra']
    this.setData({
      practiceMode: modes[index]
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
    const { text, gridType, practiceMode, sourceType } = this.data
    if (!text || !text.trim()) return

    const ctx = this.ctx
    const canvas = this.canvas
    if (!ctx || !canvas) return

    // 根据来源类型设置格子规格
    let gridSize, columns, rows
    if (sourceType === 'course') {
      // 课程模式：15mm×15mm，12字/行，15行/张
      gridSize = 55  // 逻辑像素（约15mm）
      columns = 12
      rows = 15
    } else {
      // 每日素材模式：7.5mm×8.0mm，行间距1.5mm
      gridSize = 28  // 逻辑像素（约7.5mm）
      columns = Math.floor((canvas.width / this.dpr - 40) / gridSize)
      rows = Math.floor((canvas.height / this.dpr - 40) / (gridSize + 6))
    }

    // 过滤空白字符
    const chars = text.replace(/\s+/g, '').split('')
    const padding = 20
    const actualRows = Math.ceil(chars.length / columns)
    const displayRows = Math.min(actualRows, rows)

    // 设置 Canvas 尺寸（逻辑像素）
    const canvasW = padding * 2 + columns * gridSize
    const canvasH = padding * 2 + displayRows * (gridSize + (sourceType === 'daily' ? 6 : 0))

    canvas.width = canvasW * this.dpr
    canvas.height = canvasH * this.dpr
    ctx.scale(this.dpr, this.dpr)

    // 清空画布
    ctx.clearRect(0, 0, canvasW, canvasH)

    // 绘制白色背景
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasW, canvasH)

    // 绘制格子和文字
    if (sourceType === 'course') {
      this.drawCourseGrid(ctx, padding, gridSize, columns, displayRows, chars, practiceMode)
    } else {
      this.drawDailyGrid(ctx, padding, gridSize, columns, displayRows, chars)
    }

    // 保存布局数据
    this.setData({
      layoutData: {
        width: canvasW,
        height: canvasH,
        gridSize: gridSize,
        rows: displayRows,
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

  // 绘制课程模式格子
  drawCourseGrid(ctx, padding, gridSize, columns, rows, chars, practiceMode) {
    const charSize = gridSize * 0.65
    let fontFamily
    if (this.data.fontStyle === '默认') {
      fontFamily = 'serif'
    } else {
      fontFamily = `'${this.data.fontStyle}', serif`
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const x = padding + col * gridSize
        const y = padding + row * gridSize
        const charIndex = row * columns + col

        // 绘制格子
        this.drawGrid(ctx, x, y, gridSize, this.data.gridType)

        // 根据练习模式绘制文字
        if (charIndex < chars.length) {
          const cx = x + gridSize / 2
          const cy = y + gridSize / 2

          if (practiceMode === 'trace') {
            // 描红模式：第一个字清楚，后面浅色
            ctx.font = `${charSize}px ${fontFamily}`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            if (col === 0 && row === 0) {
              ctx.fillStyle = '#333333'
            } else {
              ctx.fillStyle = '#cccccc'
            }
            ctx.fillText(chars[charIndex], cx, cy)
          } else if (practiceMode === 'one-empty') {
            // 一字一空：第一个格子显示示范字，其他空格子
            if (col === 0) {
              ctx.font = `${charSize}px ${fontFamily}`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillStyle = '#333333'
              ctx.fillText(chars[charIndex], cx, cy)
            }
          } else if (practiceMode === 'one-extra') {
            // 一字一空+额外空行：第一行第一个格子显示示范字，其他空格子
            if (col === 0 && row % 2 === 0) {
              ctx.font = `${charSize}px ${fontFamily}`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillStyle = '#333333'
              ctx.fillText(chars[charIndex], cx, cy)
            }
          }
        }
      }
    }
  },

  // 绘制每日素材模式格子
  drawDailyGrid(ctx, padding, gridSize, columns, rows, chars) {
    const charSize = gridSize * 0.65
    let fontFamily
    if (this.data.fontStyle === '默认') {
      fontFamily = 'serif'
    } else {
      fontFamily = `'${this.data.fontStyle}', serif`
    }

    const rowGap = 6  // 行间距（约1.5mm）

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const x = padding + col * gridSize
        const y = padding + row * (gridSize + rowGap)
        const charIndex = row * columns + col

        // 绘制格子（高考作文格子样式）
        ctx.strokeStyle = '#d0d0d0'
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, gridSize, gridSize)

        // 绘制文字
        if (charIndex < chars.length) {
          const cx = x + gridSize / 2
          const cy = y + gridSize / 2
          ctx.font = `${charSize}px ${fontFamily}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#333333'
          ctx.fillText(chars[charIndex], cx, cy)
        }
      }
    }
  },

  // 绘制 A4 课程模式格子
  drawA4CourseGrid(ctx, offsetX, offsetY, gridSize, columns, rows, chars, practiceMode, fontStyle) {
    const charSize = gridSize * 0.65
    let fontFamily
    if (fontStyle === '默认') {
      fontFamily = 'serif'
    } else {
      fontFamily = `'${fontStyle}', serif`
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const x = offsetX + col * gridSize
        const y = offsetY + row * gridSize
        const charIndex = row * columns + col

        // 绘制格子
        this.drawGrid(ctx, x, y, gridSize, this.data.gridType)

        // 根据练习模式绘制文字
        if (charIndex < chars.length) {
          const cx = x + gridSize / 2
          const cy = y + gridSize / 2

          if (practiceMode === 'trace') {
            // 描红模式：第一个字清楚，后面浅色
            ctx.font = `${charSize}px ${fontFamily}`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            if (col === 0 && row === 0) {
              ctx.fillStyle = '#333333'
            } else {
              ctx.fillStyle = '#cccccc'
            }
            ctx.fillText(chars[charIndex], cx, cy)
          } else if (practiceMode === 'one-empty') {
            // 一字一空：第一个格子显示示范字，其他空格子
            if (col === 0) {
              ctx.font = `${charSize}px ${fontFamily}`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillStyle = '#333333'
              ctx.fillText(chars[charIndex], cx, cy)
            }
          } else if (practiceMode === 'one-extra') {
            // 一字一空+额外空行：第一行第一个格子显示示范字，其他空格子
            if (col === 0 && row % 2 === 0) {
              ctx.font = `${charSize}px ${fontFamily}`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillStyle = '#333333'
              ctx.fillText(chars[charIndex], cx, cy)
            }
          }
        }
      }
    }
  },

  // 绘制 A4 每日素材模式格子
  drawA4DailyGrid(ctx, offsetX, offsetY, gridSize, columns, rows, chars, rowGap, fontStyle) {
    const charSize = gridSize * 0.65
    let fontFamily
    if (fontStyle === '默认') {
      fontFamily = 'serif'
    } else {
      fontFamily = `'${fontStyle}', serif`
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const x = offsetX + col * gridSize
        const y = offsetY + row * (gridSize + rowGap)
        const charIndex = row * columns + col

        // 绘制格子（高考作文格子样式）
        ctx.strokeStyle = '#d0d0d0'
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, gridSize, gridSize)

        // 绘制文字
        if (charIndex < chars.length) {
          const cx = x + gridSize / 2
          const cy = y + gridSize / 2
          ctx.font = `${charSize}px ${fontFamily}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#333333'
          ctx.fillText(chars[charIndex], cx, cy)
        }
      }
    }
  },

  // 绘制 A4 尺寸字帖（用于打印导出）
  drawA4Copybook() {
    const { text, gridType, fontStyle, practiceMode, sourceType } = this.data
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

    // 根据来源类型设置格子规格
    let gridSize, columns, rows, rowGap
    if (sourceType === 'course') {
      // 课程模式：15mm×15mm，12字/行，15行/张
      gridSize = Math.floor(availW / 12)
      columns = 12
      rows = 15
      rowGap = 0
    } else {
      // 每日素材模式：7.5mm×8.0mm，行间距1.5mm
      gridSize = Math.floor(availW / 24)  // 约7.5mm
      columns = Math.floor(availW / gridSize)
      rowGap = Math.floor(gridSize * 0.2)  // 约1.5mm
      rows = Math.floor(availH / (gridSize + rowGap))
    }

    // 过滤空白字符
    const chars = text.replace(/\s+/g, '').split('')

    // 居中偏移
    const totalW = columns * gridSize
    const actualRows = Math.ceil(chars.length / columns)
    const displayRows = Math.min(actualRows, rows)
    const totalH = displayRows * (gridSize + rowGap)
    const offsetX = MARGIN + Math.floor((availW - totalW) / 2)
    const offsetY = MARGIN + Math.floor((availH - totalH) / 2)

    // 清空并绘制白色背景
    ctx.clearRect(0, 0, A4_W, A4_H)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, A4_W, A4_H)

    // 绘制格子和文字
    if (sourceType === 'course') {
      this.drawA4CourseGrid(ctx, offsetX, offsetY, gridSize, columns, displayRows, chars, practiceMode, fontStyle)
    } else {
      this.drawA4DailyGrid(ctx, offsetX, offsetY, gridSize, columns, displayRows, chars, rowGap, fontStyle)
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

      // 如果是课程模式，标记课程完成
      if (this.data.lessonNo > 0) {
        try {
          const completeRes = await copybookService.completeCourseLesson(this.data.lessonNo)
          if (completeRes && completeRes.code === 0) {
            if (completeRes.data && completeRes.data.justUnlocked) {
              wx.showModal({
                title: '恭喜！',
                content: '你已完成全部课程，每日素材已解锁！',
                showCancel: false
              })
            }
          }
        } catch (err) {
          console.warn('标记课程完成失败:', err)
        }
      }

      // 3. 调用云函数保存生成记录
      await copybookService.generateCopybook({
        text: this.data.text,
        fontStyle: this.data.fontStyle,
        gridType: this.data.gridType,
        sourceType: this.data.sourceType,
        practiceMode: this.data.practiceMode,
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
        sourceType: this.data.sourceType,
        practiceMode: this.data.practiceMode,
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
  },

  // 预览大图
  previewImage() {
    if (!this.data.layoutData) return

    // 先绘制 A4 尺寸字帖
    this.drawA4Copybook()

    // 导出为临时文件
    this.a4CanvasToTempFile().then(tempFilePath => {
      wx.previewImage({
        urls: [tempFilePath],
        current: tempFilePath
      })
    }).catch(err => {
      console.error('预览失败:', err)
      wx.showToast({ title: '预览失败', icon: 'none' })
    })
  }
})
