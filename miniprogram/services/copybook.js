// services/copybook.js - 字帖服务封装
// 提供文章素材管理、字帖生成、字帖库等功能接口

const { callAPI } = require('./api')

/**
 * 获取文章列表
 * @param {object} params - 查询参数 { category, keyword, page, pageSize }
 * @returns {Promise<object>} 文章列表
 */
function getArticles(params) {
  return callAPI('fetchArticles', {
    type: 'list',
    ...params
  })
}

/**
 * 获取文章详情
 * @param {string} id - 文章ID
 * @returns {Promise<object>} 文章详情
 */
function getArticleDetail(id) {
  return callAPI('fetchArticles', {
    type: 'detail',
    id: id
  })
}

/**
 * 生成字帖布局
 * @param {object} params - 生成参数 { text, fontStyle, gridType, fontSize, columns, articleId }
 * @returns {Promise<object>} 布局数据，包含 layout 信息
 */
function generateCopybook(params) {
  return callAPI('generateCopybook', params)
}

/**
 * 获取已生成字帖列表
 * @param {object} params - 查询参数 { page, pageSize }
 * @returns {Promise<object>} 字帖列表
 */
function getMyGallery(params) {
  return callAPI('getRecords', {
    type: 'copybooks',
    ...params
  })
}

/**
 * 初始化默认素材
 * @returns {Promise<object>} 初始化结果
 */
function initArticles() {
  return callAPI('fetchArticles', {
    type: 'init'
  })
}

/**
 * 添加自定义素材
 * @param {object} data - 素材数据 { source, title, content, tags }
 * @returns {Promise<object>} 添加结果
 */
function addArticle(data) {
  return callAPI('fetchArticles', {
    type: 'add',
    ...data
  })
}

module.exports = {
  getArticles,
  getArticleDetail,
  generateCopybook,
  getMyGallery,
  initArticles,
  addArticle
}
