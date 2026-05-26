// pages/copybook/articles/index.js - 素材文章列表（课程 + 每日素材）
const copybookService = require('../../../services/copybook')
const appConfig = require('../../../config')

// 阶段名称映射
const STAGE_NAMES = {
  1: '控笔与基本笔画',
  2: '高频偏旁部首',
  3: '间架结构黄金法则',
  4: '高考易错高频字实战',
  5: '实用篇章书写'
}

Page({
  data: {
    // Tab
    activeTab: 0, // 0=课程, 1=每日素材

    // 课程数据
    lessons: [],           // 全部课程列表
    lessonsByStage: [],    // 按阶段分组
    courseProgress: null,  // 用户进度

    // 每日素材数据
    dailyArticle: null,
    dailyLoading: false,

    // 通用
    mode: 'prod',
    loading: false,
    initialized: false
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    if (this.data.initialized) {
      this.refreshProgress()
    }
  },

  // 加载所有数据
  async loadData() {
    this.setData({ loading: true })
    try {
      // 并行加载课程列表和用户进度
      const [lessonsRes, progressRes] = await Promise.all([
        copybookService.getCourseLessons(),
        copybookService.getCourseProgress()
      ])

      let lessons = []
      if (lessonsRes && lessonsRes.code === 0) {
        lessons = lessonsRes.data || []
      }

      let courseProgress = { currentLesson: 1, completedLessons: [], dailyUnlocked: false, totalPoints: 0 }
      if (progressRes && progressRes.code === 0) {
        courseProgress = progressRes.data || courseProgress
      }

      // 按阶段分组
      const lessonsByStage = this.groupByStage(lessons, courseProgress)

      this.setData({
        lessons,
        lessonsByStage,
        courseProgress,
        mode: appConfig.mode,
        initialized: true
      })

      // 如果在每日素材tab，加载素材
      if (this.data.activeTab === 1) {
        this.loadDailyArticle()
      }
    } catch (err) {
      console.error('加载数据失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 刷新进度（从页面返回时）
  async refreshProgress() {
    try {
      const progressRes = await copybookService.getCourseProgress()
      if (progressRes && progressRes.code === 0) {
        const courseProgress = progressRes.data || this.data.courseProgress
        const lessonsByStage = this.groupByStage(this.data.lessons, courseProgress)
        this.setData({ courseProgress, lessonsByStage })
      }
    } catch (err) {
      console.error('刷新进度失败', err)
    }
  },

  // 按阶段分组课程
  groupByStage(lessons, progress) {
    const isDev = appConfig.mode === 'dev'
    const completedLessons = progress.completedLessons || []
    const currentLesson = progress.currentLesson || 1

    const stageMap = {}
    lessons.forEach(lesson => {
      if (!stageMap[lesson.stage]) {
        stageMap[lesson.stage] = {
          stage: lesson.stage,
          stageName: lesson.stageName || STAGE_NAMES[lesson.stage] || `阶段${lesson.stage}`,
          lessons: []
        }
      }

      const isCompleted = completedLessons.includes(lesson.lessonNo)
      const isCurrent = lesson.lessonNo === currentLesson
      const isUnlocked = isDev || isCompleted || isCurrent

      stageMap[lesson.stage].lessons.push({
        ...lesson,
        isCompleted,
        isCurrent,
        isUnlocked,
        statusText: isCompleted ? '✅' : (isCurrent ? '🔓' : '🔒')
      })
    })

    return Object.values(stageMap).sort((a, b) => a.stage - b.stage)
  },

  // 切换Tab
  switchTab(e) {
    const tab = parseInt(e.currentTarget.dataset.tab)
    this.setData({ activeTab: tab })
    if (tab === 1 && !this.data.dailyArticle && !this.data.dailyLoading) {
      this.loadDailyArticle()
    }
  },

  // 加载今日素材
  async loadDailyArticle() {
    const isUnlocked = appConfig.mode === 'dev' || (this.data.courseProgress && this.data.courseProgress.dailyUnlocked)
    if (!isUnlocked) return

    this.setData({ dailyLoading: true })
    try {
      const res = await copybookService.getDailyArticle()
      if (res && res.code === 0) {
        if (res.data) {
          this.setData({ dailyArticle: res.data })
        } else {
          // 今日素材不存在，触发生成
          this.generateDailyArticle()
        }
      }
    } catch (err) {
      console.error('加载每日素材失败:', err)
    } finally {
      this.setData({ dailyLoading: false })
    }
  },

  // 触发生成今日素材
  async generateDailyArticle() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'generateDailyArticle',
        data: {}
      })
      if (res.result && res.result.code === 0) {
        // 生成成功，重新加载
        const articleRes = await copybookService.getDailyArticle()
        if (articleRes && articleRes.code === 0 && articleRes.data) {
          this.setData({ dailyArticle: articleRes.data })
        }
      }
    } catch (err) {
      console.error('触发生成每日素材失败:', err)
    }
  },

  // 点击课程
  onTapLesson(e) {
    const lesson = e.currentTarget.dataset.lesson
    if (!lesson.isUnlocked) {
      wx.showToast({ title: '请先完成前面的课程', icon: 'none' })
      return
    }

    // content 只传练习字，tips 单独传递
    wx.navigateTo({
      url: `/pages/copybook/generate/index?content=${encodeURIComponent(lesson.practiceChars)}&tips=${encodeURIComponent(lesson.tips)}&source=${encodeURIComponent('第' + lesson.lessonNo + '课：' + lesson.title)}&lessonNo=${lesson.lessonNo}`
    })
  },

  // 点击每日素材
  onTapDailyArticle() {
    if (!this.data.dailyArticle) return
    const article = this.data.dailyArticle
    wx.navigateTo({
      url: `/pages/copybook/generate/index?articleId=${article._id}&content=${encodeURIComponent(article.content)}&source=${encodeURIComponent('每日素材')}`
    })
  },

  // 阻止冒泡
  preventBubble() {}
})
