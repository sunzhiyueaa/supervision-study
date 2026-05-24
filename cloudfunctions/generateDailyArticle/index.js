// 云函数 generateDailyArticle - 每日AI素材生成
// 定时触发：每天凌晨2:00
// 仅在有用户解锁每日素材后才调用AI
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 从config获取模式配置（云函数中通过环境变量或硬编码）
// 注意：云函数无法直接require前端的config.js，需要单独维护
const MODE = 'dev' // 'dev' | 'prod' — 部署前改为 'prod'

exports.main = async (event, context) => {
  try {
    // 1. 检查是否有用户解锁了每日素材
    if (MODE !== 'dev') {
      const unlockedUsers = await db.collection('users')
        .where({ 'courseProgress.dailyUnlocked': true })
        .count()

      if (unlockedUsers.total === 0) {
        return { code: 0, message: '暂无用户解锁，跳过生成' }
      }
    }

    // 2. 检查今天是否已生成
    const today = getTodayStr()
    let existRes
    try {
      existRes = await db.collection('copybook_articles')
        .where({ publishDate: today })
        .count()
    } catch (err) {
      // 集合不存在时，尝试创建集合并继续
      if (err.errCode === -502005) {
        console.warn('copybook_articles 集合不存在，将由AI生成后自动创建')
        existRes = { total: 0 }
      } else {
        throw err
      }
    }

    if (existRes.total > 0) {
      return { code: 0, message: '今日素材已存在' }
    }

    // 3. 调用微信云AI生成素材
    const aiResult = await generateWithAI()
    if (!aiResult) {
      return { code: -1, message: 'AI生成失败' }
    }

    // 4. 存入数据库
    await db.collection('copybook_articles').add({
      data: {
        title: aiResult.title,
        content: aiResult.content,
        source: 'AI每日生成',
        tags: ['高考作文素材', '每日素材'],
        publishDate: today,
        charCount: aiResult.content.length,
        createdAt: db.serverDate()
      }
    })

    return { code: 0, message: '生成成功', data: { title: aiResult.title } }
  } catch (err) {
    console.error('每日素材生成失败:', err)
    return { code: -1, message: '生成失败: ' + err.message }
  }
}

// 调用微信云AI
async function generateWithAI() {
  try {
    const prompt = `请生成一篇适合高中生练字的高考作文素材，要求：
1. 内容为真实感人的社会新闻或人物故事
2. 字数100-200字
3. 语言优美，适合书写练习
4. 有正能量，适合高考作文引用
5. 返回格式：第一行为标题，空一行后为正文

示例格式：
《平凡中的光芒》

深夜的急诊室里，一位护士已经连续工作了16个小时...`

    // 使用云开发AI接口
    const result = await cloud.openapi.ai.bot.sendMessage({
      query: prompt
    })

    if (result && result.answer) {
      return parseAIResult(result.answer)
    }

    console.warn('AI调用未返回结果，使用备用方案')
    return getFallbackArticle()
  } catch (err) {
    console.error('AI调用失败:', err)
    return getFallbackArticle()
  }
}

// 解析AI返回结果
function parseAIResult(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  let title = '每日素材'
  let content = text

  if (lines.length > 1) {
    const firstLine = lines[0].trim()
    if (firstLine.startsWith('《') || firstLine.length <= 20) {
      title = firstLine.replace(/[《》]/g, '')
      content = lines.slice(1).join('\n').trim()
    }
  }

  return { title, content }
}

// 备用素材（AI调用失败时使用）
function getFallbackArticle() {
  const articles = [
    {
      title: '坚守',
      content: '大山深处的乡村教师张老师，二十年如一日坚守在三尺讲台。每天清晨五点起床，步行两小时山路赶到学校，只为不耽误孩子们一堂课。他说："知识能改变命运，我愿意做那座桥。"在他的坚持下，村里走出了三十多名大学生。平凡的坚守，铸就不凡的丰碑。'
    },
    {
      title: '微光',
      content: '寒冬深夜，外卖骑手李明发现路边一位老人摔倒在地。他毫不犹豫停下车，脱下自己的棉衣披在老人身上，拨打了急救电话。等待救护车的二十分钟里，他一直握着老人冰冷的手。事后有人问他怕不怕被讹，他笑着说："那一刻只想着救人，别的来不及想。"善良从来不需要理由，它是黑夜中最温暖的微光。'
    },
    {
      title: '传承',
      content: '故宫文物修复师王师傅，从业三十五年，修复了上千件国宝级文物。一把刻刀、一盏台灯，他在寂静的修复室里与历史对话。年轻时师傅告诉他："文物修复急不得，一笔一划都要对得起古人。"如今他也这样教导徒弟。匠心传承，让千年文明在指尖延续。'
    }
  ]

  const index = Math.floor(Math.random() * articles.length)
  return articles[index]
}

// 获取今天日期字符串
function getTodayStr() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
