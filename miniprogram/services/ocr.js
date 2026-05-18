// services/ocr.js - 百度OCR服务封装
// 通过云函数调用百度OCR API，前端不直接暴露密钥

const { callAPI } = require('./api')

/**
 * 识别图片中的文字
 * @param {string} fileID - 云存储文件ID
 * @param {string} type - 识别类型: 'handwriting'(手写) | 'general'(通用)
 * @returns {Promise<object>} 识别结果 { code, data: { words, probability, fullText, wordsCount } }
 */
function recognizeText(fileID, type = 'handwriting') {
  if (!fileID) {
    return Promise.resolve({
      code: -1,
      message: '缺少fileID参数',
      data: null
    })
  }

  return callAPI('ocrRecognize', {
    fileID,
    type
  }).catch(err => {
    console.error('OCR识别调用失败:', err)
    return {
      code: -1,
      message: 'OCR识别服务异常，请稍后重试',
      data: null
    }
  })
}

/**
 * 识别手写文字（快捷方法）
 * @param {string} fileID - 云存储文件ID
 * @returns {Promise<object>} 识别结果
 */
function recognizeHandwriting(fileID) {
  return recognizeText(fileID, 'handwriting')
}

/**
 * 通用文字识别（支持英文等）
 * @param {string} fileID - 云存储文件ID
 * @returns {Promise<object>} 识别结果
 */
function recognizeGeneral(fileID) {
  return recognizeText(fileID, 'general')
}

/**
 * 获取字体评分
 * @param {string} fileID - 云存储文件ID
 * @param {object} ocrResult - 可选的OCR结果（如果已有可传入，避免重复识别）
 * @returns {Promise<object>} 评分结果 { code, data: { totalScore, breakdown, comment, ocrText } }
 */
function getCalligraphyScore(fileID, ocrResult) {
  if (!fileID) {
    return Promise.resolve({
      code: -1,
      message: '缺少fileID参数',
      data: null
    })
  }

  const data = { fileID }
  if (ocrResult) {
    data.ocrResult = ocrResult
  }

  return callAPI('scoreCalligraphy', data).catch(err => {
    console.error('字体评分调用失败:', err)
    return {
      code: -1,
      message: '评分服务异常，请稍后重试',
      data: null
    }
  })
}

module.exports = {
  recognizeText,
  recognizeHandwriting,
  recognizeGeneral,
  getCalligraphyScore
}
