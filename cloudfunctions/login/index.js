// 云函数 login - 用户登录注册
// 获取openid，查询或创建用户，返回用户信息
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    // 查询用户是否已存在
    const userRes = await db.collection('users').where({ openid }).get()

    if (userRes.data.length > 0) {
      // 用户已存在，返回用户信息
      const user = userRes.data[0]
      return {
        code: 0,
        message: '登录成功',
        data: user
      }
    } else {
      // 新用户，创建记录
      const newUser = {
        openid: openid,
        nickname: '',
        avatar: '',
        totalPoints: 0,
        reminderTime: '20:00',
        reminderEnabled: false,
        createdAt: db.serverDate()
      }

      const addRes = await db.collection('users').add({ data: newUser })
      newUser._id = addRes._id

      return {
        code: 0,
        message: '注册成功',
        data: newUser
      }
    }
  } catch (err) {
    console.error('登录失败:', err)
    return {
      code: -1,
      message: '登录失败',
      data: null
    }
  }
}
