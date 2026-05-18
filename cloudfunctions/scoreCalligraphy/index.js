// 云函数 scoreCalligraphy - 字体评分
// 对上传的练字图片进行评分
// 评分维度：识别置信度(40分)、字数量(20分)、工整度(40分)
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { fileID, ocrResult } = event

  try {
    // 如果没有传入OCR结果，先调用 ocrRecognize 获取
    let ocrData = ocrResult
    if (!ocrData || !ocrData.words || ocrData.words.length === 0) {
      const ocrRes = await cloud.callFunction({
        name: 'ocrRecognize',
        data: { fileID, type: 'handwriting' }
      })
      if (ocrRes.result && ocrRes.result.code === 0) {
        ocrData = ocrRes.result.data
      } else {
        // OCR失败时给默认低分
        return {
          code: 0,
          data: {
            totalScore: 40,
            breakdown: {
              confidence: 10,
              quantity: 5,
              neatness: 25
            },
            comment: '识别困难，请确保图片清晰',
            ocrText: ''
          }
        }
      }
    }

    // 提取OCR数据
    const words = ocrData.words || []
    const probabilities = ocrData.probability || []
    const fullText = ocrData.fullText || words.join('')

    // === 评分算法（满分100分）===

    // 1. 识别置信度（40分）
    let confidenceScore = 0
    if (probabilities.length > 0) {
      const avgProbability = probabilities.reduce((sum, p) => sum + p, 0) / probabilities.length
      confidenceScore = Math.round(avgProbability * 40)
    }
    confidenceScore = Math.min(40, Math.max(0, confidenceScore))

    // 2. 字数量分（20分）
    let quantityScore = 0
    const wordCount = words.length
    if (wordCount >= 30) {
      quantityScore = 20
    } else if (wordCount >= 15) {
      quantityScore = 15
    } else if (wordCount >= 5) {
      quantityScore = 10
    } else {
      quantityScore = 5
    }

    // 3. 工整度估计（40分）- 基于置信度方差
    let neatnessScore = 0
    if (probabilities.length >= 2) {
      const avgProb = probabilities.reduce((sum, p) => sum + p, 0) / probabilities.length
      // 计算方差
      const variance = probabilities.reduce((sum, p) => sum + Math.pow(p - avgProb, 2), 0) / probabilities.length

      if (variance < 0.01) {
        neatnessScore = 40
      } else if (variance < 0.05) {
        neatnessScore = 30
      } else if (variance < 0.1) {
        neatnessScore = 20
      } else {
        neatnessScore = 10
      }
    } else if (probabilities.length === 1) {
      // 只有一个字，无法计算方差，给中等分
      neatnessScore = 25
    } else {
      neatnessScore = 10
    }

    // 总分
    const totalScore = Math.min(100, confidenceScore + quantityScore + neatnessScore)

    // 生成评语
    const comment = getComment(totalScore)

    return {
      code: 0,
      data: {
        totalScore,
        breakdown: {
          confidence: confidenceScore,
          quantity: quantityScore,
          neatness: neatnessScore
        },
        comment,
        ocrText: fullText
      }
    }
  } catch (err) {
    console.error('评分失败:', err)
    return {
      code: -1,
      message: '评分失败: ' + (err.message || '未知错误'),
      data: null
    }
  }
}

/**
 * 根据总分生成评语
 * @param {number} score - 总分
 * @returns {string} 评语
 */
function getComment(score) {
  if (score >= 90) {
    return '优秀！书写工整美观，继续保持！'
  } else if (score >= 80) {
    return '良好！书写规范，继续加油！'
  } else if (score >= 70) {
    return '不错！有一定基础，再接再厉！'
  } else if (score >= 60) {
    return '加油！多加练习，一定会进步的！'
  } else {
    return '需要努力！坚持每天练字，慢慢就会好起来的！'
  }
}
