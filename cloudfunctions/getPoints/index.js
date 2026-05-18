// 云函数 getPoints - 积分查询
// 支持 type='summary'(积分总览) | 'history'(积分记录) | 'achievements'(成就徽章)
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 成就徽章定义
const ACHIEVEMENTS = [
  {
    id: 'first_checkin',
    name: '初露锋芒',
    desc: '首次打卡',
    icon: '🌟',
    condition: 'firstCheckin'
  },
  {
    id: 'streak_7',
    name: '坚持不懈',
    desc: '连续7天打卡',
    icon: '🔥',
    condition: 'streak7'
  },
  {
    id: 'streak_30',
    name: '月度之星',
    desc: '连续30天打卡',
    icon: '👑',
    condition: 'streak30'
  },
  {
    id: 'score_master',
    name: '书法达人',
    desc: '累计评分90+达5次',
    icon: '✒️',
    condition: 'scoreMaster'
  },
  {
    id: 'mistake_killer',
    name: '错题克星',
    desc: '累计记录错题100条',
    icon: '🎯',
    condition: 'mistakeKiller'
  },
  {
    id: 'top_student',
    name: '学习标兵',
    desc: '总积分达1000分',
    icon: '🏆',
    condition: 'topStudent'
  }
]

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { type } = event

  try {
    switch (type) {
      case 'summary':
        return await getSummary(openid)
      case 'history':
        return await getHistory(openid, event)
      case 'achievements':
        return await getAchievements(openid)
      default:
        // 兼容旧调用：默认返回总览
        return await getSummary(openid)
    }
  } catch (err) {
    console.error('获取积分失败:', err)
    return { code: -1, message: '获取积分失败', data: null }
  }
}

// 积分总览
async function getSummary(openid) {
  // 获取用户信息
  const userRes = await db.collection('users').where({ openid }).get()
  const user = userRes.data[0] || {}
  const totalPoints = user.totalPoints || 0

  // 计算今日积分
  const todayStr = formatDate(new Date())
  const todayStart = new Date(todayStr + ' 00:00:00')
  const todayEnd = new Date(todayStr + ' 23:59:59')
  const todayLogRes = await db.collection('points_log').where({
    openid,
    createdAt: _.gte(todayStart).and(_.lte(todayEnd))
  }).get()
  const todayPoints = todayLogRes.data.reduce((sum, item) => sum + item.points, 0)

  // 计算本周积分（周一到今天）
  const now = new Date()
  const dayOfWeek = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek + 1)
  const weekStart = new Date(formatDate(monday) + ' 00:00:00')
  const weekLogRes = await db.collection('points_log').where({
    openid,
    createdAt: _.gte(weekStart)
  }).get()
  const weekPoints = weekLogRes.data.reduce((sum, item) => sum + item.points, 0)

  // 计算连续打卡天数
  const streakDays = await calculateStreak(openid)

  // 获取成就列表
  const achievementList = await buildAchievementList(openid, user, streakDays)

  return {
    code: 0,
    data: {
      totalPoints,
      todayPoints,
      weekPoints,
      streakDays,
      achievements: achievementList
    }
  }
}

// 积分记录列表（分页）
async function getHistory(openid, event) {
  const page = event.page || 1
  const pageSize = event.pageSize || 20
  const skip = (page - 1) * pageSize

  // 查询积分记录
  const [logRes, countRes] = await Promise.all([
    db.collection('points_log').where({ openid })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get(),
    db.collection('points_log').where({ openid }).count()
  ])

  // 按日期分组
  const groupedLogs = {}
  logRes.data.forEach(item => {
    const dateKey = formatDate(item.createdAt)
    if (!groupedLogs[dateKey]) {
      groupedLogs[dateKey] = []
    }
    groupedLogs[dateKey].push({
      _id: item._id,
      points: item.points,
      description: item.description,
      type: item.type,
      createdAt: item.createdAt
    })
  })

  // 转为数组并按日期排序
  const groupedArray = Object.keys(groupedLogs)
    .sort((a, b) => b.localeCompare(a))
    .map(date => ({
      date,
      items: groupedLogs[date]
    }))

  return {
    code: 0,
    data: {
      list: groupedArray,
      total: countRes.total,
      page,
      pageSize,
      hasMore: skip + logRes.data.length < countRes.total
    }
  }
}

// 成就徽章列表及解锁状态
async function getAchievements(openid) {
  const userRes = await db.collection('users').where({ openid }).get()
  const user = userRes.data[0] || {}
  const streakDays = await calculateStreak(openid)
  const achievementList = await buildAchievementList(openid, user, streakDays)

  return {
    code: 0,
    data: {
      achievements: achievementList
    }
  }
}

// 构建成就列表（含解锁状态）
async function buildAchievementList(openid, user, streakDays) {
  const totalPoints = user.totalPoints || 0

  // 查询首次打卡
  const firstCheckinRes = await db.collection('daily_records').where({
    openid, type: 'checkin'
  }).orderBy('createdAt', 'asc').limit(1).get()
  const hasFirstCheckin = firstCheckinRes.data.length > 0

  // 查询评分90+次数
  const highScoreRes = await db.collection('daily_records').where({
    openid, type: 'checkin', score: _.gte(90)
  }).count()

  // 查询错题总数
  const mistakeRes = await db.collection('daily_records').where({
    openid, type: 'mistake'
  }).count()

  // 判断各成就是否解锁
  const conditions = {
    firstCheckin: hasFirstCheckin,
    streak7: streakDays >= 7,
    streak30: streakDays >= 30,
    scoreMaster: highScoreRes.total >= 5,
    mistakeKiller: mistakeRes.total >= 100,
    topStudent: totalPoints >= 1000
  }

  return ACHIEVEMENTS.map(ach => ({
    id: ach.id,
    name: ach.name,
    desc: ach.desc,
    icon: ach.icon,
    unlocked: conditions[ach.condition] || false
  }))
}

// 计算连续打卡天数
async function calculateStreak(openid) {
  let streak = 0
  const today = new Date()

  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = formatDate(d)

    const res = await db.collection('daily_records').where({
      openid, date: dateStr, type: 'checkin'
    }).count()

    if (res.total > 0) {
      streak++
    } else {
      // 今天还没打卡不算断连，从昨天开始算
      if (i === 0) continue
      break
    }
  }

  return streak
}

// 日期格式化辅助
function formatDate(date) {
  if (!(date instanceof Date)) {
    date = new Date(date)
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
