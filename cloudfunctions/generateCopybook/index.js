// 云函数 generateCopybook - 生成字帖布局数据
// 接收文本和配置参数，计算布局坐标并返回 JSON 数据
// 前端使用 Canvas 2D 根据布局数据渲染字帖
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 计算字帖布局数据
 * @param {string} text - 文本内容
 * @param {string} gridType - 格子类型：田字格/米字格/方格/横线
 * @param {string} fontSize - 字号：small/medium/large
 * @param {number} columns - 每行字数
 * @returns {object} 布局数据
 */
function computeLayout(text, gridType, fontSize, columns) {
  // 字号映射到格子大小（rpx）
  const gridSizeMap = { small: 60, medium: 80, large: 100 }
  const gridSize = gridSizeMap[fontSize] || 80

  // 过滤文本中的空白和换行
  const chars = text.replace(/\s+/g, '').split('')
  const padding = 20

  // 计算行列
  const rows = Math.ceil(chars.length / columns)

  // 计算页面尺寸
  const width = padding * 2 + columns * gridSize
  const height = padding * 2 + rows * gridSize

  // 生成每个字的坐标信息
  const charLayouts = chars.map((char, index) => {
    const row = Math.floor(index / columns)
    const col = index % columns
    const x = padding + col * gridSize + gridSize / 2
    const y = padding + row * gridSize + gridSize / 2
    return {
      char: char,
      x: x,
      y: y,
      row: row,
      col: col
    }
  })

  // 生成格子信息
  const grids = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = padding + col * gridSize
      const y = padding + row * gridSize
      grids.push({
        x: x,
        y: y,
        size: gridSize,
        type: gridType
      })
    }
  }

  return {
    width: width,
    height: height,
    gridSize: gridSize,
    padding: padding,
    columns: columns,
    rows: rows,
    chars: charLayouts,
    grids: grids,
    gridType: gridType,
    fontSize: fontSize
  }
}

exports.main = async (event, context) => {
  const { text, fontStyle, gridType, fontSize, columns, articleId } = event
  const wxContext = cloud.getWXContext()

  // 参数校验
  if (!text || text.trim().length === 0) {
    return { code: -1, message: '文本内容不能为空', data: null }
  }

  const actualGridType = gridType || '田字格'
  const actualFontSize = fontSize || 'medium'
  const actualColumns = columns || 8
  const actualFontStyle = fontStyle || '楷体'

  try {
    // 计算布局数据
    const layout = computeLayout(text, actualGridType, actualFontSize, actualColumns)

    // 保存生成记录到数据库
    const record = {
      openid: wxContext.OPENID,
      articleId: articleId || '',
      text: text,
      fontStyle: actualFontStyle,
      gridType: actualGridType,
      fontSize: actualFontSize,
      columns: actualColumns,
      charCount: text.replace(/\s+/g, '').length,
      createdAt: db.serverDate()
    }

    const addRes = await db.collection('copybook_generated').add({ data: record })

    return {
      code: 0,
      data: {
        id: addRes._id,
        layout: layout
      }
    }
  } catch (err) {
    console.error('生成字帖布局失败:', err)
    return { code: -1, message: '生成字帖布局失败', data: null }
  }
}
