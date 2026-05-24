// 云函数 fetchArticles - 文章素材管理
// 支持 list/detail/add/daily 四种操作类型
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 获取文章列表
 * 支持 category/tags/keyword 筛选、分页
 */
async function getArticleList(event) {
  const { category, keyword, page = 1, pageSize = 10 } = event
  try {
    let query = {}

    // 按分类筛选（支持 tags 数组中包含该分类）
    if (category) {
      query.tags = _.elemMatch(_.eq(category))
    }

    // 关键词搜索（搜索 content 和 title）
    if (keyword) {
      query = _.and(
        query,
        _.or([
          { content: db.RegExp({ regexp: keyword, options: 'i' }) },
          { title: db.RegExp({ regexp: keyword, options: 'i' }) },
          { source: db.RegExp({ regexp: keyword, options: 'i' }) }
        ])
      )
    }

    let totalRes, res
    try {
      totalRes = await db.collection('copybook_articles').where(query).count()
      res = await db.collection('copybook_articles').where(query)
        .orderBy('createdAt', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()
    } catch (dbErr) {
      // 集合不存在时返回空列表
      if (dbErr.errCode === -502005) {
        console.warn('copybook_articles 集合不存在，请在云开发控制台创建')
        return { code: 0, data: [], total: 0, page: 1, hasMore: false }
      }
      throw dbErr
    }

    return {
      code: 0,
      data: res.data,
      total: totalRes.total,
      page: page,
      hasMore: totalRes.total > page * pageSize
    }
  } catch (err) {
    console.error('获取文章列表失败:', err)
    return { code: -1, message: '获取文章列表失败', data: null }
  }
}

/**
 * 获取文章详情
 */
async function getArticleDetail(event) {
  const { id } = event
  if (!id) {
    return { code: -1, message: '缺少文章ID', data: null }
  }
  try {
    const res = await db.collection('copybook_articles').doc(id).get()
    return { code: 0, data: res.data }
  } catch (err) {
    console.error('获取文章详情失败:', err)
    return { code: -1, message: '文章不存在', data: null }
  }
}

/**
 * 获取今日每日素材
 */
async function getDailyArticle() {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const todayStr = `${y}-${m}-${d}`

  try {
    const res = await db.collection('copybook_articles')
      .where({ publishDate: todayStr })
      .limit(1)
      .get()

    return {
      code: 0,
      data: res.data.length > 0 ? res.data[0] : null
    }
  } catch (err) {
    // 集合不存在时返回空数据，而不是报错
    if (err.errCode === -502005) {
      console.warn('copybook_articles 集合不存在，请在云开发控制台创建')
      return { code: 0, data: null }
    }
    console.error('获取今日素材失败:', err)
    return { code: -1, message: '获取今日素材失败', data: null }
  }
}

/**
 * 添加文章素材
 */
async function addArticle(event) {
  const { source, title, content, tags } = event
  if (!content || !title) {
    return { code: -1, message: '标题和内容不能为空', data: null }
  }
  try {
    const article = {
      source: source || '自定义',
      title: title,
      content: content,
      tags: tags || ['自定义'],
      publishDate: new Date().toISOString().slice(0, 10),
      charCount: content.length,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
    const res = await db.collection('copybook_articles').add({ data: article })
    return { code: 0, data: { _id: res._id, ...article }, message: '添加成功' }
  } catch (err) {
    console.error('添加文章失败:', err)
    return { code: -1, message: '添加文章失败', data: null }
  }
}

// 云函数入口
exports.main = async (event, context) => {
  const { type } = event

  switch (type) {
    case 'list':
      return await getArticleList(event)
    case 'detail':
      return await getArticleDetail(event)
    case 'add':
      return await addArticle(event)
    case 'daily':
      return await getDailyArticle()
    default:
      return await getArticleList(event)
  }
}
