// 云函数 getRecords - 获取历史记录
// 支持：今日记录、仪表盘、月度记录、日期记录、错题列表、字帖列表、字体列表、统计
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { type } = event

  try {
    switch (type) {
      case 'today':
        return await getTodayRecord(openid)
      case 'dashboard':
        return await getDashboard(openid)
      case 'month':
        return await getMonthRecords(openid, event)
      case 'day':
        return await getDayRecords(openid, event)
      case 'mistakes':
        return await getMistakes(openid, event)
      case 'copybooks':
        return await getCopybooks(openid, event)
      case 'fonts':
        return await getFonts(openid)
      case 'stats':
        return await getStats(openid)
      case 'course_progress':
        return await getCourseProgress(openid)
      case 'course_lessons':
        return await getCourseLessons(event)
      default:
        return { code: -1, message: '未知查询类型', data: null }
    }
  } catch (err) {
    console.error('获取记录失败:', err)
    return { code: -1, message: '查询失败', data: null }
  }
}

// 获取今日记录（打卡状态 + 错题数量）
async function getTodayRecord(openid) {
  const today = formatDate(new Date())

  // 并行执行所有查询以提高性能
  const [checkinRes, mistakeCount, userRes] = await Promise.all([
    db.collection('daily_records').where({
      openid,
      date: today,
      type: 'checkin'
    }).get(),
    db.collection('daily_records').where({
      openid,
      type: 'mistake',
      date: today
    }).count(),
    db.collection('users').where({ openid }).get()
  ])

  const checkedIn = checkinRes.data.length > 0
  const record = checkedIn ? checkinRes.data[0] : null
  const user = userRes.data[0] || {}

  return {
    code: 0,
    data: {
      checkedIn,
      record,
      todayMistakeCount: mistakeCount.total || 0,
      totalPoints: user.totalPoints || 0
    }
  }
}

// 获取仪表盘数据（首页所需所有数据）
async function getDashboard(openid) {
  const today = formatDate(new Date())
  const weekDates = getWeekDates()

  // 并行执行所有查询以提高性能
  const [todayCheckin, todayMistakeCount, streakDays, weekCheckins, userRes] = await Promise.all([
    db.collection('daily_records').where({
      openid, date: today, type: 'checkin'
    }).get(),
    db.collection('daily_records').where({
      openid, type: 'mistake', date: today
    }).count(),
    calculateStreak(openid),
    db.collection('daily_records').where({
      openid, type: 'checkin',
      date: _.in(weekDates)
    }).get(),
    db.collection('users').where({ openid }).get()
  ])

  const checkedDates = weekCheckins.data.map(r => r.date)
  const user = userRes.data[0] || {}

  return {
    code: 0,
    data: {
      todayCheckedIn: todayCheckin.data.length > 0,
      todayMistakeCount: todayMistakeCount.total || 0,
      streakDays,
      totalPoints: user.totalPoints || 0,
      checkedDates
    }
  }
}

// 计算连续打卡天数（优化版：一次查询获取最近记录）
async function calculateStreak(openid) {
  const today = new Date()
  const todayStr = formatDate(today)

  // 查询最近90天的打卡记录（足够覆盖绝大多数连续打卡场景）
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - 90)
  const startStr = formatDate(startDate)

  const res = await db.collection('daily_records').where({
    openid,
    type: 'checkin',
    date: _.gte(startStr).and(_.lte(todayStr))
  }).orderBy('date', 'desc').get()

  // 构建日期集合
  const dateSet = new Set(res.data.map(r => r.date))

  // 计算连续天数
  let streak = 0
  for (let i = 0; i < 90; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = formatDate(d)

    if (dateSet.has(dateStr)) {
      streak++
    } else {
      // 如果是今天且还没打卡，跳过今天继续算
      if (i === 0) continue
      break
    }
  }

  return streak
}

// 获取月度记录
async function getMonthRecords(openid, event) {
  const { year, month } = event
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  // 并行执行查询以提高性能
  const [res, streakDays] = await Promise.all([
    db.collection('daily_records').where({
      openid,
      type: 'checkin',
      date: _.gte(startDate).and(_.lte(endDate))
    }).get(),
    calculateStreak(openid)
  ])

  const checkedDates = res.data.map(r => r.date)
  const monthCheckins = res.data.length

  // 平均评分
  let avgScore = 0
  if (res.data.length > 0) {
    const totalScore = res.data.reduce((sum, r) => sum + (r.score || 0), 0)
    avgScore = Math.round(totalScore / res.data.length)
  }

  return {
    code: 0,
    data: {
      checkedDates,
      monthCheckins,
      streakDays,
      avgScore
    }
  }
}

// 获取某日记录
async function getDayRecords(openid, event) {
  const { date } = event
  const res = await db.collection('daily_records').where({
    openid, date, type: 'checkin'
  }).get()

  return {
    code: 0,
    data: { records: res.data }
  }
}

// 获取错题列表 - 支持 subject 和 date 筛选
async function getMistakes(openid, event) {
  const { subject, date } = event
  let query = { openid, type: 'mistake' }

  // 按科目筛选
  if (subject && subject !== 'all') {
    query.subject = subject
  }

  // 按日期筛选
  if (date) {
    query.date = date
  }

  // 兼容旧版 filter 参数
  if (event.filter === 'unsolved') {
    query.solved = false
  } else if (event.filter === 'solved') {
    query.solved = true
  }

  // 并行执行所有查询以提高性能
  const today = formatDate(new Date())
  const weekDates = getWeekDates()
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [res, todayCount, weekCount, monthCount] = await Promise.all([
    db.collection('daily_records').where(query)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get(),
    db.collection('daily_records').where({
      openid, type: 'mistake', date: today
    }).count(),
    db.collection('daily_records').where({
      openid, type: 'mistake',
      date: _.in(weekDates)
    }).count(),
    db.collection('daily_records').where({
      openid, type: 'mistake',
      date: _.gte(monthStart)
    }).count()
  ])

  return {
    code: 0,
    data: {
      list: res.data,
      stats: {
        todayCount: todayCount.total || 0,
        weekCount: weekCount.total || 0,
        monthCount: monthCount.total || 0
      }
    }
  }
}

// 获取字帖列表（支持分页）
async function getCopybooks(openid, event) {
  const page = (event && event.page) || 1
  const pageSize = 10
  const skip = (page - 1) * pageSize

  const totalRes = await db.collection('copybook_generated').where({ openid }).count()
  const res = await db.collection('copybook_generated').where({ openid })
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()

  return {
    code: 0,
    data: res.data,
    total: totalRes.total,
    page: page,
    hasMore: totalRes.total > page * pageSize
  }
}

// 获取统计
async function getStats(openid) {
  const res = await db.collection('daily_records').where({
    openid, type: 'checkin'
  }).count()

  return {
    code: 0,
    data: { totalCheckins: res.total }
  }
}

// 获取用户课程进度
async function getCourseProgress(openid) {
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    const user = userRes.data[0] || {}
    const progress = user.courseProgress || {
      currentLesson: 1,
      completedLessons: [],
      dailyUnlocked: false
    }

    return {
      code: 0,
      data: {
        ...progress,
        totalPoints: user.totalPoints || 0
      }
    }
  } catch (err) {
    console.error('获取课程进度失败:', err)
    return { code: -1, message: '获取课程进度失败', data: null }
  }
}

// 获取课程列表
async function getCourseLessons(event) {
  const { stage } = event
  try {
    let query = {}
    if (stage) {
      query.stage = stage
    }

    const res = await db.collection('course_lessons')
      .where(query)
      .orderBy('lessonNo', 'asc')
      .get()

    return {
      code: 0,
      data: res.data
    }
  } catch (err) {
    console.error('获取课程列表失败:', err)
    return { code: -1, message: '获取课程列表失败', data: null }
  }
}

// 获取用户字体列表
async function getFonts(openid) {
  const res = await db.collection('user_fonts').where({ openid })
    .orderBy('createdAt', 'desc')
    .get()

  return {
    code: 0,
    data: res.data
  }
}

// 辅助函数
function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getWeekDates() {
  const today = new Date()
  const dayOfWeek = today.getDay() || 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - dayOfWeek + 1)

  const dates = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(formatDate(d))
  }
  return dates
}
