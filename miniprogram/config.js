// config.js - 全局配置
const envs = {
  dev: {
    // cloudEnv: 'supervision-dev',  // 开发环境
    mode: 'dev',
  },
  prod: {
    // cloudEnv: 'supervision-prod',           // 生产环境
    mode: 'prod',
  }
}

const currentEnv = 'dev'  // 上线时改为 'prod'

const envConfig = envs[currentEnv]

module.exports = {
  env: 'cloud',
  cloudEnv: envConfig.cloudEnv,
  mode: envConfig.mode,
  unlock: {
    requiredLessons: 37,
    requiredPoints: 500
  }
}
