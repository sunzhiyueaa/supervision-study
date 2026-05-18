// utils/auth.js - 登录态管理
// 获取用户信息、角色判断、登录状态检查

const { callAPI } = require('../services/api')

/**
 * 检查登录状态，未登录则自动登录
 * @returns {Promise<object>} 用户信息
 */
async function checkLogin() {
  const app = getApp()

  // 先从内存缓存获取
  if (app.globalData.userInfo) {
    return app.globalData.userInfo
  }

  // 从本地缓存获取
  try {
    const cachedInfo = wx.getStorageSync('userInfo')
    if (cachedInfo && cachedInfo.openid) {
      app.globalData.userInfo = cachedInfo
      app.globalData.openid = cachedInfo.openid
      return cachedInfo
    }
  } catch (err) {
    console.error('读取本地缓存失败', err)
  }

  // 调用云函数登录
  try {
    const res = await callAPI('login', {})
    if (res && res.code === 0) {
      const userInfo = res.data
      app.globalData.userInfo = userInfo
      app.globalData.openid = userInfo.openid

      // 缓存到本地
      wx.setStorageSync('userInfo', userInfo)

      return userInfo
    }
  } catch (err) {
    console.error('自动登录失败', err)
  }

  return null
}

/**
 * 获取当前用户信息
 * @returns {Promise<object|null>} 用户信息
 */
async function getUserInfo() {
  const app = getApp()

  // 内存缓存
  if (app.globalData.userInfo) {
    return app.globalData.userInfo
  }

  // 本地缓存
  try {
    const cachedInfo = wx.getStorageSync('userInfo')
    if (cachedInfo && cachedInfo.openid) {
      app.globalData.userInfo = cachedInfo
      app.globalData.openid = cachedInfo.openid
      return cachedInfo
    }
  } catch (err) {
    console.error('读取本地缓存失败', err)
  }

  // 重新登录
  return await checkLogin()
}

/**
 * 获取当前用户的 openid
 * @returns {Promise<string|null>}
 */
async function getOpenId() {
  const app = getApp()
  if (app.globalData.openid) {
    return app.globalData.openid
  }

  const userInfo = await getUserInfo()
  return userInfo ? userInfo.openid : null
}

/**
 * 清除登录态
 */
function clearLogin() {
  const app = getApp()
  app.globalData.userInfo = null
  app.globalData.openid = null
  wx.removeStorageSync('userInfo')
}

module.exports = {
  checkLogin,
  getUserInfo,
  getOpenId,
  clearLogin
}
