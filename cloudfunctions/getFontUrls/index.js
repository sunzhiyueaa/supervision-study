// 云函数 getFontUrls - 获取字体文件临时链接
// 云函数以管理员权限调用 getTempFileURL，可绕过"仅创建者可读"限制
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { fileList } = event

  if (!fileList || !Array.isArray(fileList) || fileList.length === 0) {
    return { code: -1, message: '缺少 fileList 参数' }
  }

  try {
    const result = await cloud.getTempFileURL({ fileList })
    return {
      code: 0,
      data: result.fileList
    }
  } catch (err) {
    console.error('获取字体临时链接失败:', err)
    return { code: -1, message: err.message }
  }
}
