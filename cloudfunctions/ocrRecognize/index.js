// 云函数 ocrRecognize - OCR识别
// 调用百度OCR API识别图片中的文字
const cloud = require('wx-server-sdk')
const https = require('https')
const querystring = require('querystring')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 百度OCR配置（从环境变量读取）
const BAIDU_API_KEY = process.env.BAIDU_API_KEY || ''
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY || ''

exports.main = async (event, context) => {
  const { fileID, type = 'handwriting' } = event

  // 校验参数
  if (!fileID) {
    return { code: -1, message: '缺少fileID参数', data: null }
  }

  if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) {
    return { code: -1, message: '百度OCR未配置，请设置环境变量 BAIDU_API_KEY 和 BAIDU_SECRET_KEY', data: null }
  }

  try {
    // 1. 下载图片
    const downloadRes = await cloud.downloadFile({ fileID })
    const imageBuffer = downloadRes.fileContent
    const imageBase64 = imageBuffer.toString('base64')

    // 2. 获取 access_token（带缓存）
    const accessToken = await getAccessToken()

    // 3. 根据类型选择OCR接口
    let ocrUrl
    if (type === 'general') {
      // 通用文字识别（支持英文等）
      ocrUrl = `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${accessToken}`
    } else {
      // 手写文字识别（默认）
      ocrUrl = `https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting?access_token=${accessToken}`
    }

    // 4. 调用百度OCR API
    const ocrResult = await httpRequest(ocrUrl, {
      image: imageBase64,
      detect_direction: 'true',
      probability: 'true'
    })

    // 5. 解析结果
    if (ocrResult.error_code) {
      console.error('百度OCR API错误:', ocrResult.error_code, ocrResult.error_msg)
      return {
        code: -1,
        message: `OCR识别失败: ${ocrResult.error_msg || '未知错误'}`,
        data: null
      }
    }

    const wordsResult = ocrResult.words_result || []
    const words = wordsResult.map(item => item.words)
    const probability = wordsResult.map(item => {
      // 手写识别返回 probability.probability，通用识别可能不返回
      if (item.probability && item.probability.probability !== undefined) {
        return item.probability.probability
      }
      return item.probability || 0.8 // 默认置信度
    })
    const fullText = words.join('')

    return {
      code: 0,
      data: {
        words,
        probability,
        fullText,
        wordsCount: words.length
      }
    }
  } catch (err) {
    console.error('OCR识别失败:', err)
    return {
      code: -1,
      message: 'OCR识别失败: ' + (err.message || '未知错误'),
      data: null
    }
  }
}

/**
 * 获取百度 access_token，带数据库缓存
 * 缓存有效期30天，提前1天刷新
 */
async function getAccessToken() {
  // 先从数据库缓存读取
  try {
    const cacheRes = await db.collection('baidu_token_cache')
      .where({ _id: 'baidu_access_token' })
      .get()

    if (cacheRes.data && cacheRes.data.length > 0) {
      const cache = cacheRes.data[0]
      const now = Date.now()
      // 提前1天刷新（30天 - 1天 = 29天 = 29 * 24 * 3600 * 1000 ms）
      if (cache.expireTime && cache.expireTime > now + 24 * 3600 * 1000) {
        return cache.accessToken
      }
    }
  } catch (e) {
    console.warn('读取token缓存失败，将重新获取:', e.message)
  }

  // 缓存不存在或已过期，重新获取
  const tokenUrl = 'https://aip.baidubce.com/oauth/2.0/token'
  const params = querystring.stringify({
    grant_type: 'client_credentials',
    client_id: BAIDU_API_KEY,
    client_secret: BAIDU_SECRET_KEY
  })

  const fullUrl = `${tokenUrl}?${params}`
  const tokenData = await httpGet(fullUrl)

  if (!tokenData.access_token) {
    throw new Error('获取百度access_token失败: ' + (tokenData.error_description || JSON.stringify(tokenData)))
  }

  const accessToken = tokenData.access_token
  const expiresIn = tokenData.expires_in || 2592000 // 默认30天
  const expireTime = Date.now() + expiresIn * 1000

  // 写入缓存（upsert）
  try {
    const existing = await db.collection('baidu_token_cache')
      .where({ _id: 'baidu_access_token' })
      .get()

    if (existing.data && existing.data.length > 0) {
      await db.collection('baidu_token_cache')
        .doc(existing.data[0]._id)
        .update({ accessToken, expireTime, updatedAt: db.serverDate() })
    } else {
      await db.collection('baidu_token_cache').add({
        data: {
          _id: 'baidu_access_token',
          accessToken,
          expireTime,
          updatedAt: db.serverDate()
        }
      })
    }
  } catch (e) {
    console.warn('缓存token失败（不影响使用）:', e.message)
  }

  return accessToken
}

/**
 * HTTPS POST 请求（使用 Node.js 内置 https 模块）
 * @param {string} url - 请求URL
 * @param {object} data - 请求数据
 * @returns {Promise<object>} 响应JSON
 */
function httpRequest(url, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const postData = querystring.stringify(data)

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (e) {
          reject(new Error('解析百度OCR响应失败: ' + body.substring(0, 200)))
        }
      })
    })

    req.on('error', (e) => {
      reject(new Error('请求百度OCR失败: ' + e.message))
    })

    req.write(postData)
    req.end()
  })
}

/**
 * HTTPS GET 请求
 * @param {string} url - 请求URL
 * @returns {Promise<object>} 响应JSON
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)

    https.get({
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET'
    }, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (e) {
          reject(new Error('解析响应失败: ' + body.substring(0, 200)))
        }
      })
    }).on('error', (e) => {
      reject(new Error('GET请求失败: ' + e.message))
    })
  })
}
