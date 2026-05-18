// components/score-card/score-card.js - 评分卡片组件
// 展示评分结果：圆环进度条、各项分数、评语、识别文字

Component({
  properties: {
    // 总分
    score: {
      type: Number,
      value: 0
    },
    // 各项分数明细
    breakdown: {
      type: Object,
      value: {
        confidence: 0,
        quantity: 0,
        neatness: 0
      }
    },
    // 评语
    comment: {
      type: String,
      value: ''
    },
    // OCR识别文字
    ocrText: {
      type: String,
      value: ''
    }
  },

  data: {
    // 圆环进度参数
    circleRadius: 60,    // rpx
    circleStroke: 8,     // rpx
    dashArray: 0,
    dashOffset: 0,
    // 是否展开识别文字
    showOcrText: false,
    // 分数等级颜色
    scoreColor: '#07c160',
    // 各项进度百分比
    confidencePercent: 0,
    quantityPercent: 0,
    neatnessPercent: 0
  },

  observers: {
    'score, breakdown': function (score, breakdown) {
      this.updateScoreDisplay(score, breakdown)
    }
  },

  lifetimes: {
    attached() {
      this.updateScoreDisplay(this.data.score, this.data.breakdown)
    }
  },

  methods: {
    // 更新分数展示
    updateScoreDisplay(score, breakdown) {
      // 圆环周长（2πr，使用rpx）
      const radius = this.data.circleRadius
      const circumference = 2 * Math.PI * radius
      const progress = Math.min(100, Math.max(0, score)) / 100
      const dashOffset = circumference * (1 - progress)

      // 根据分数设定颜色
      let scoreColor = '#07c160'
      if (score >= 90) {
        scoreColor = '#07c160'  // 绿色
      } else if (score >= 80) {
        scoreColor = '#4cd964'  // 浅绿
      } else if (score >= 70) {
        scoreColor = '#FF9800'  // 橙色
      } else if (score >= 60) {
        scoreColor = '#FFC107'  // 黄色
      } else {
        scoreColor = '#f44336'  // 红色
      }

      // 各项百分比（满分：confidence=40, quantity=20, neatness=40）
      const bd = breakdown || {}
      const confidencePercent = Math.round((bd.confidence || 0) / 40 * 100)
      const quantityPercent = Math.round((bd.quantity || 0) / 20 * 100)
      const neatnessPercent = Math.round((bd.neatness || 0) / 40 * 100)

      this.setData({
        dashArray: circumference,
        dashOffset,
        scoreColor,
        confidencePercent,
        quantityPercent,
        neatnessPercent
      })
    },

    // 切换识别文字展开
    toggleOcrText() {
      this.setData({
        showOcrText: !this.data.showOcrText
      })
    }
  }
})
