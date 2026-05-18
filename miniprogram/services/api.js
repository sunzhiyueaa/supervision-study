// services/api.js - 统一API层
// 当前使用云开发，后续可切换为独立后端

const config = {
  env: 'cloud', // 'cloud' | 'server'
  baseUrl: ''   // 独立后端时使用
}

/**
 * 统一API调用函数
 * @param {string} name - 云函数名/接口名
 * @param {object} data - 请求数据
 * @returns {Promise} 返回结果
 */
function callAPI(name, data) {
  if (config.env === 'cloud') {
    return wx.cloud.callFunction({
      name: name,
      data: data
    }).then(res => {
      return res.result
    }).catch(err => {
      console.error(`云函数调用失败 [${name}]:`, err)
      throw err
    })
  } else {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${config.baseUrl}/api/${name}`,
        method: 'POST',
        data: data,
        header: {
          'content-type': 'application/json',
          'Authorization': wx.getStorageSync('token') || ''
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data)
          } else {
            reject(new Error(`请求失败，状态码: ${res.statusCode}`))
          }
        },
        fail: reject
      })
    })
  }
}

// ========== 积分相关接口 ==========

/**
 * 获取积分总览
 * @returns {Promise} { totalPoints, todayPoints, weekPoints, streakDays, achievements }
 */
function getPointsSummary() {
  return callAPI('getPoints', { type: 'summary' })
}

/**
 * 获取积分记录（分页）
 * @param {number} page - 页码
 * @param {number} pageSize - 每页条数
 * @returns {Promise} { list, total, page, pageSize, hasMore }
 */
function getPointsHistory(page, pageSize) {
  return callAPI('getPoints', { type: 'history', page: page || 1, pageSize: pageSize || 20 })
}

/**
 * 获取成就徽章列表
 * @returns {Promise} { achievements }
 */
function getAchievements() {
  return callAPI('getPoints', { type: 'achievements' })
}

module.exports = { callAPI, config, getPointsSummary, getPointsHistory, getAchievements }
