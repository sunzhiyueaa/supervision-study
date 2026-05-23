// 云函数 sendReminder - 发送练字提醒
// 通过微信订阅消息发送递增提醒
// 定时触发器在每天 19:00, 20:00, 21:00 各检查一次
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 订阅消息模板ID（需在微信公众平台申请后替换）
const TEMPLATE_ID = 'wUNI9FwYhbLe5rwqn9PdlPdbOPyLG2_GcX_LfzEBGrU'

// 提醒消息内容模板（递增强度）
const REMINDER_MESSAGES = [
  '今天还没有完成练字哦，快来打卡吧！',
  '已超过设定时间1小时，还没有完成练字打卡，快去练习吧！',
  '已超过设定时间2小时啦！坚持每天练字才能进步，快去打卡！'
]

exports.main = async (event, context) => {
  try {
    // 获取当前时间（小时和分钟）
    const now = new Date()
    // 云函数中获取的是 UTC 时间，转为北京时间（UTC+8）
    const bjNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const currentHour = bjNow.getHours()
    const currentMinute = bjNow.getMinutes()
    const currentTimeStr = String(currentHour).padStart(2, '0') + ':' + String(currentMinute).padStart(2, '0')
    const todayStr = formatDate(bjNow)

    // 查询所有开启了提醒的用户
    const MAX_LIMIT = 100
    let allUsers = []
    let offset = 0

    // 分页获取所有开启提醒的用户
    while (true) {
      const usersRes = await db.collection('users').where({
        reminderEnabled: true
      }).skip(offset).limit(MAX_LIMIT).get()

      if (usersRes.data.length === 0) break
      allUsers = allUsers.concat(usersRes.data)
      offset += MAX_LIMIT

      if (usersRes.data.length < MAX_LIMIT) break
    }

    let sentCount = 0
    let skipCount = 0

    for (const user of allUsers) {
      const openid = user.openid
      const reminderTime = user.reminderTime || '20:00'

      // 检查是否需要发送提醒（判断时间匹配）
      const reminderLevel = getReminderLevel(currentTimeStr, reminderTime)

      if (reminderLevel === -1) {
        skipCount++
        continue
      }

      // 检查用户今天是否已订阅（一次性模板需要每天重新订阅）
      if (user.subscribedDate !== todayStr) {
        skipCount++
        continue
      }

      // 检查今天是否已完成打卡
      const checkinRes = await db.collection('daily_records').where({
        openid,
        type: 'checkin',
        date: todayStr
      }).count()

      if (checkinRes.total > 0) {
        // 已打卡，不需要提醒
        skipCount++
        continue
      }

      // 检查今天是否已经发送过该级别的提醒
      const reminderLogRes = await db.collection('reminders').where({
        openid,
        date: todayStr,
        level: reminderLevel
      }).count()

      if (reminderLogRes.total > 0) {
        // 该级别提醒已发送，跳过
        skipCount++
        continue
      }

      // 发送订阅消息
      try {
        const messageText = REMINDER_MESSAGES[reminderLevel] || REMINDER_MESSAGES[0]
        const sendTimeStr = formatDate(bjNow) + ' ' + currentTimeStr

        await cloud.openapi.subscribeMessage.send({
          touser: openid,
          templateId: TEMPLATE_ID,
          page: 'pages/checkin/index',
          data: {
            thing1: { value: '练字打卡' },
            time2: { value: sendTimeStr },
            thing3: { value: messageText }
          }
        })

        // 记录已发送提醒
        await db.collection('reminders').add({
          data: {
            openid,
            date: todayStr,
            level: reminderLevel,
            templateId: TEMPLATE_ID,
            message: messageText,
            sentAt: db.serverDate(),
            createdAt: db.serverDate()
          }
        })

        // 发送成功后清除订阅日期（权限已消耗）
        await db.collection('users').where({ openid }).update({
          data: { subscribedDate: '' }
        })

        sentCount++
      } catch (sendErr) {
        // 订阅消息发送失败（可能用户未订阅），记录但不中断
        console.error(`发送提醒失败 [${openid}]:`, sendErr)

        // 记录失败日志
        await db.collection('reminders').add({
          data: {
            openid,
            date: todayStr,
            level: reminderLevel,
            templateId: TEMPLATE_ID,
            message: '发送失败: ' + (sendErr.errCode || sendErr.message || '未知错误'),
            sentAt: db.serverDate(),
            createdAt: db.serverDate(),
            failed: true
          }
        })
      }
    }

    return {
      code: 0,
      message: `检查完成：发送 ${sentCount} 条，跳过 ${skipCount} 条`,
      data: { sentCount, skipCount, total: allUsers.length }
    }
  } catch (err) {
    console.error('发送提醒失败:', err)
    return {
      code: -1,
      message: '发送提醒失败',
      data: null
    }
  }
}

/**
 * 判断当前时间应该发送第几级提醒
 * @param {string} currentTime - 当前时间 HH:mm
 * @param {string} reminderTime - 用户设定的提醒时间 HH:mm
 * @returns {number} -1=不需要提醒, 0=首次, 1=1小时后, 2=2小时后
 */
function getReminderLevel(currentTime, reminderTime) {
  const current = timeToMinutes(currentTime)
  const reminder = timeToMinutes(reminderTime)

  // 首次提醒：当前时间 >= 设定时间，且在1小时内
  if (current >= reminder && current < reminder + 60) {
    return 0
  }
  // 第二次提醒：超过1小时但不到2小时
  if (current >= reminder + 60 && current < reminder + 120) {
    return 1
  }
  // 第三次提醒：超过2小时但不到3小时
  if (current >= reminder + 120 && current < reminder + 180) {
    return 2
  }
  // 不需要提醒
  return -1
}

/**
 * 将 HH:mm 转为分钟数
 */
function timeToMinutes(timeStr) {
  const parts = timeStr.split(':')
  return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

/**
 * 日期格式化
 */
function formatDate(date) {
  if (!(date instanceof Date)) {
    date = new Date(date)
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
