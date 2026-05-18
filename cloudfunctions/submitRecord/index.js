// 云函数 submitRecord - 提交各类记录
// 支持：练字打卡、错题本、错题删除、字帖保存、设置更新、个人资料更新
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
      case undefined:
      case 'checkin':
        // 练字打卡
        return await submitCheckin(openid, event)
      case 'mistake':
        // 添加错题
        return await addMistake(openid, event)
      case 'mistake_update':
        // 更新错题状态
        return await updateMistake(openid, event)
      case 'mistake_delete':
        // 删除错题
        return await deleteMistake(openid, event)
      case 'copybook':
        // 保存字帖
        return await saveCopybook(openid, event)
      case 'updateSettings':
        // 更新设置
        return await updateSettings(openid, event)
      case 'updateProfile':
        // 更新个人资料
        return await updateProfile(openid, event)
      case 'updateScore':
        // 更新打卡评分
        return await updateScore(openid, event)
      default:
        return { code: -1, message: '未知记录类型' }
    }
  } catch (err) {
    console.error('提交记录失败:', err)
    return { code: -1, message: '提交失败', data: null }
  }
}

// 练字打卡 - 支持多图
async function submitCheckin(openid, event) {
  const { images, date } = event

  // 检查今日是否已打卡
  const existRes = await db.collection('daily_records').where({
    openid,
    date,
    type: 'checkin'
  }).get()

  if (existRes.data.length > 0) {
    return { code: -1, message: '今日已打卡', data: null }
  }

  // 计算积分
  let earnedPoints = 10 // 基础打卡积分

  // 插入打卡记录（支持 images 数组，兼容旧版 photoUrl 字段）
  await db.collection('daily_records').add({
    data: {
      openid,
      type: 'checkin',
      images: images || [],
      // 兼容：第一张图同时存为 photoUrl
      photoUrl: (images && images.length > 0) ? images[0] : '',
      score: 0,
      comment: '',
      date,
      earnedPoints,
      createdAt: db.serverDate()
    }
  })

  // 更新用户积分
  await db.collection('users').where({ openid }).update({
    data: { totalPoints: _.inc(earnedPoints) }
  })

  // 记录积分日志
  await db.collection('points_log').add({
    data: {
      openid,
      points: earnedPoints,
      description: '练字打卡',
      type: 'checkin',
      createdAt: db.serverDate()
    }
  })

  // 检查连续打卡奖励
  await checkStreakBonus(openid, date)

  return { code: 0, message: '打卡成功', data: { earnedPoints } }
}

// 检查连续打卡奖励
async function checkStreakBonus(openid, currentDate) {
  // 计算连续天数（从今天往前查最多30天）
  const today = new Date(currentDate)
  let streak = 0
  const dateSet = new Set()

  // 查询最近30天打卡记录
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)
  const records = await db.collection('daily_records').where({
    openid,
    type: 'checkin',
    date: _.gte(formatDate(thirtyDaysAgo)).and(_.lte(currentDate))
  }).orderBy('date', 'desc').get()

  records.data.forEach(r => dateSet.add(r.date))

  for (let i = 0; i < 30; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = formatDate(d)
    if (dateSet.has(dateStr)) {
      streak++
    } else {
      break
    }
  }

  // 连续7天额外奖励 +50分
  if (streak >= 7 && streak % 7 === 0) {
    const bonusPoints = 50
    await db.collection('points_log').add({
      data: {
        openid,
        points: bonusPoints,
        description: '连续打卡7天奖励',
        type: 'streak_bonus',
        createdAt: db.serverDate()
      }
    })
    await db.collection('users').where({ openid }).update({
      data: { totalPoints: _.inc(bonusPoints) }
    })
  }

  // 连续30天额外奖励 +200分
  if (streak >= 30 && streak % 30 === 0) {
    const bonusPoints = 200
    await db.collection('points_log').add({
      data: {
        openid,
        points: bonusPoints,
        description: '连续打卡30天奖励',
        type: 'streak_bonus_30',
        createdAt: db.serverDate()
      }
    })
    await db.collection('users').where({ openid }).update({
      data: { totalPoints: _.inc(bonusPoints) }
    })
  }
}

// 日期格式化辅助
function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 添加错题 - 支持 images 数组、errorType、description
async function addMistake(openid, event) {
  const { subject, images, description, errorType, date } = event

  if (!subject) {
    return { code: -1, message: '请选择科目', data: null }
  }

  const now = new Date()
  const todayStr = date || formatDate(now)

  await db.collection('daily_records').add({
    data: {
      openid,
      type: 'mistake',
      subject,
      images: images || [],
      // 兼容：第一张图同时存为 photoUrl
      photoUrl: (images && images.length > 0) ? images[0] : '',
      description: description || '',
      errorType: errorType || '',
      question: description || '', // 兼容旧字段
      answer: '',
      date: todayStr,
      solved: false,
      createdAt: db.serverDate()
    }
  })

  // 记录积分
  const earnedPoints = 5
  await db.collection('points_log').add({
    data: {
      openid,
      points: earnedPoints,
      description: '记录错题',
      type: 'mistake',
      createdAt: db.serverDate()
    }
  })
  await db.collection('users').where({ openid }).update({
    data: { totalPoints: _.inc(earnedPoints) }
  })

  return { code: 0, message: '添加成功', data: null }
}

// 更新错题状态
async function updateMistake(openid, event) {
  const { mistakeId, solved } = event
  // 安全检查：确保该记录属于当前用户
  const record = await db.collection('daily_records').doc(mistakeId).get()
  if (!record.data || record.data.openid !== openid) {
    return { code: -1, message: '无权操作', data: null }
  }

  await db.collection('daily_records').doc(mistakeId).update({
    data: { solved }
  })
  return { code: 0, message: '更新成功', data: null }
}

// 删除错题
async function deleteMistake(openid, event) {
  const { mistakeId } = event
  // 安全检查：确保该记录属于当前用户
  const record = await db.collection('daily_records').doc(mistakeId).get()
  if (!record.data || record.data.openid !== openid) {
    return { code: -1, message: '无权操作', data: null }
  }

  await db.collection('daily_records').doc(mistakeId).remove()

  // 扣除积分
  const deductPoints = -5
  await db.collection('points_log').add({
    data: {
      openid,
      points: deductPoints,
      description: '删除错题',
      type: 'mistake_delete',
      createdAt: db.serverDate()
    }
  })
  await db.collection('users').where({ openid }).update({
    data: { totalPoints: _.inc(deductPoints) }
  })

  return { code: 0, message: '删除成功', data: null }
}

// 保存字帖
async function saveCopybook(openid, event) {
  const { articleId, fileID, fontStyle, gridType } = event

  await db.collection('copybook_generated').add({
    data: {
      openid,
      articleId: articleId || '',
      fileID,
      fontStyle: fontStyle || '楷书',
      gridType: gridType || '田字格',
      createdAt: db.serverDate()
    }
  })

  // 生成字帖并练习 +3分
  const earnedPoints = 3
  await db.collection('points_log').add({
    data: {
      openid,
      points: earnedPoints,
      description: '生成字帖并练习',
      type: 'copybook',
      createdAt: db.serverDate()
    }
  })
  await db.collection('users').where({ openid }).update({
    data: { totalPoints: _.inc(earnedPoints) }
  })

  return { code: 0, message: '保存成功', data: null }
}

// 更新设置
async function updateSettings(openid, event) {
  const updateData = {}
  if (event.reminderEnabled !== undefined) {
    updateData.reminderEnabled = event.reminderEnabled
  }
  if (event.reminderTime !== undefined) {
    updateData.reminderTime = event.reminderTime
  }

  await db.collection('users').where({ openid }).update({
    data: updateData
  })

  return { code: 0, message: '设置已更新', data: null }
}

// 更新个人资料
async function updateProfile(openid, event) {
  const updateData = {}
  if (event.nickname) updateData.nickname = event.nickname
  if (event.avatar) updateData.avatar = event.avatar

  await db.collection('users').where({ openid }).update({
    data: updateData
  })

  return { code: 0, message: '资料已更新', data: null }
}

// 更新打卡评分
async function updateScore(openid, event) {
  const { date, score, comment, breakdown, ocrText } = event

  if (!date) {
    return { code: -1, message: '缺少日期参数', data: null }
  }

  // 查找当天的打卡记录
  const existRes = await db.collection('daily_records').where({
    openid,
    date,
    type: 'checkin'
  }).get()

  if (existRes.data.length === 0) {
    return { code: -1, message: '未找到打卡记录', data: null }
  }

  const recordId = existRes.data[0]._id
  const updateData = {
    score: score || 0,
    comment: comment || '',
    breakdown: breakdown || {},
    ocrText: ocrText || ''
  }

  await db.collection('daily_records').doc(recordId).update({
    data: updateData
  })

  // 字体评分90+额外+5分
  if (score && score >= 90) {
    // 检查是否已经发过此奖励（同一记录只发一次）
    const existBonus = await db.collection('points_log').where({
      openid,
      type: 'score_bonus',
      description: '字体评分90+奖励'
    }).count()

    // 每次评分90+都给奖励
    const bonusPoints = 5
    await db.collection('points_log').add({
      data: {
        openid,
        points: bonusPoints,
        description: '字体评分90+奖励',
        type: 'score_bonus',
        createdAt: db.serverDate()
      }
    })
    await db.collection('users').where({ openid }).update({
      data: { totalPoints: _.inc(bonusPoints) }
    })
  }

  return { code: 0, message: '评分已更新', data: null }
}
