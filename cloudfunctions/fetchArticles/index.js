// 云函数 fetchArticles - 文章素材管理
// 支持 list/detail/add/init 四种操作类型
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 预置素材数据（人民日报/半月谈经典段落，共25条）
const PRESET_ARTICLES = [
  {
    source: '人民日报',
    title: '金句摘抄',
    content: '不驰于空想，不骛于虚声。',
    tags: ['时政金句'],
    publishDate: '2026-01-01',
    charCount: 10
  },
  {
    source: '半月谈',
    title: '岁月如歌',
    content: '岁月不居，时节如流。',
    tags: ['人生哲理'],
    publishDate: '2026-01-02',
    charCount: 10
  },
  {
    source: '人民日报',
    title: '行与做',
    content: '路虽远，行则将至；事虽难，做则必成。',
    tags: ['励志名言'],
    publishDate: '2026-01-03',
    charCount: 16
  },
  {
    source: '人民日报',
    title: '少年中国',
    content: '少年强则国强，少年智则国智。',
    tags: ['励志名言'],
    publishDate: '2026-01-04',
    charCount: 14
  },
  {
    source: '英语佳句',
    title: '热爱与成就',
    content: 'The only way to do great work is to love what you do.',
    tags: ['英语佳句'],
    publishDate: '2026-01-05',
    charCount: 48
  },
  {
    source: '人民日报',
    title: '奋斗之光',
    content: '幸福都是奋斗出来的。',
    tags: ['时政金句'],
    publishDate: '2026-01-06',
    charCount: 9
  },
  {
    source: '半月谈',
    title: '志向与远方',
    content: '志之所趋，无远弗届。穷山距海，不能限也。',
    tags: ['励志名言'],
    publishDate: '2026-01-07',
    charCount: 18
  },
  {
    source: '人民日报',
    title: '山与路',
    content: '山再高，往上攀，总能登顶；路再长，走下去，定能到达。',
    tags: ['励志名言'],
    publishDate: '2026-01-08',
    charCount: 24
  },
  {
    source: '半月谈',
    title: '读书之美',
    content: '胸藏文墨虚若谷，腹有诗书气自华。',
    tags: ['文学之美'],
    publishDate: '2026-01-09',
    charCount: 14
  },
  {
    source: '人民日报',
    title: '风雨兼程',
    content: '莫听穿林打叶声，何妨吟啸且徐行。',
    tags: ['文学之美'],
    publishDate: '2026-01-10',
    charCount: 14
  },
  {
    source: '半月谈',
    title: '家国情怀',
    content: '家是最小国，国是千万家。',
    tags: ['时政金句'],
    publishDate: '2026-01-11',
    charCount: 12
  },
  {
    source: '人民日报',
    title: '时代使命',
    content: '时代是出卷人，我们是答卷人，人民是阅卷人。',
    tags: ['时政金句'],
    publishDate: '2026-01-12',
    charCount: 20
  },
  {
    source: '英语佳句',
    title: '坚持与成功',
    content: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
    tags: ['英语佳句'],
    publishDate: '2026-01-13',
    charCount: 82
  },
  {
    source: '半月谈',
    title: '知行合一',
    content: '知者行之始，行者知之成。',
    tags: ['人生哲理'],
    publishDate: '2026-01-14',
    charCount: 12
  },
  {
    source: '人民日报',
    title: '砥砺前行',
    content: '千磨万击还坚劲，任尔东西南北风。',
    tags: ['励志名言'],
    publishDate: '2026-01-15',
    charCount: 14
  },
  {
    source: '半月谈',
    title: '厚积薄发',
    content: '博观而约取，厚积而薄发。',
    tags: ['人生哲理'],
    publishDate: '2026-01-16',
    charCount: 11
  },
  {
    source: '人民日报',
    title: '春华秋实',
    content: '春种一粒粟，秋收万颗子。',
    tags: ['文学之美'],
    publishDate: '2026-01-17',
    charCount: 11
  },
  {
    source: '英语佳句',
    title: '光明与希望',
    content: 'In the middle of difficulty lies opportunity.',
    tags: ['英语佳句'],
    publishDate: '2026-01-18',
    charCount: 44
  },
  {
    source: '人民日报',
    title: '初心不改',
    content: '不忘初心，方得始终。',
    tags: ['时政金句'],
    publishDate: '2026-01-19',
    charCount: 8
  },
  {
    source: '半月谈',
    title: '天道酬勤',
    content: '天行健，君子以自强不息。',
    tags: ['励志名言'],
    publishDate: '2026-01-20',
    charCount: 12
  },
  {
    source: '人民日报',
    title: '星辰大海',
    content: '我们的征途是星辰大海。',
    tags: ['励志名言'],
    publishDate: '2026-01-21',
    charCount: 11
  },
  {
    source: '半月谈',
    title: '静水流深',
    content: '静水流深，沧笙踏歌。',
    tags: ['文学之美'],
    publishDate: '2026-01-22',
    charCount: 9
  },
  {
    source: '人民日报',
    title: '人民至上',
    content: '江山就是人民，人民就是江山。',
    tags: ['时政金句'],
    publishDate: '2026-01-23',
    charCount: 14
  },
  {
    source: '英语佳句',
    title: '梦想与行动',
    content: 'The future belongs to those who believe in the beauty of their dreams.',
    tags: ['英语佳句'],
    publishDate: '2026-01-24',
    charCount: 72
  },
  {
    source: '半月谈',
    title: '以梦为马',
    content: '以梦为马，不负韶华。',
    tags: ['励志名言'],
    publishDate: '2026-01-25',
    charCount: 9
  }
]

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

    const totalRes = await db.collection('copybook_articles').where(query).count()
    const res = await db.collection('copybook_articles').where(query)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

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

/**
 * 初始化默认素材
 * 仅在集合为空时写入预置数据
 */
async function initArticles() {
  try {
    const countRes = await db.collection('copybook_articles').count()
    if (countRes.total > 0) {
      return { code: 0, message: '素材已存在，无需初始化', data: { count: countRes.total } }
    }

    const promises = PRESET_ARTICLES.map(article => {
      return db.collection('copybook_articles').add({
        data: {
          ...article,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
    })

    await Promise.all(promises)
    return { code: 0, message: '初始化成功', data: { count: PRESET_ARTICLES.length } }
  } catch (err) {
    console.error('初始化素材失败:', err)
    return { code: -1, message: '初始化素材失败', data: null }
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
    case 'init':
      return await initArticles()
    default:
      // 兼容旧调用方式（无 type 时默认为 list）
      return await getArticleList(event)
  }
}
