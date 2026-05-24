// config.js - 全局配置
const config = {
  // 云环境：'cloud' | 'server'
  env: 'cloud',

  // 运行模式：'dev' | 'prod'
  // dev: 跳过解锁验证，所有课程和每日素材直接可用（方便测试）
  // prod: 正常解锁逻辑
  mode: 'dev',

  // 每日素材解锁门槛
  unlock: {
    requiredLessons: 37,    // 需完成全部37课
    requiredPoints: 500     // 需要500积分
  }
}

module.exports = config
