// app.js - 应用入口，初始化云开发环境
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-d9ggmhuqye1b0cb43',
        traceUser: true,
      })
    }
    this.globalData = {
      userInfo: null,
      openid: null
    }
  }
})
