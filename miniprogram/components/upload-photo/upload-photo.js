// components/upload-photo/upload-photo.js - 照片上传组件（支持多图）
Component({
  properties: {
    // 最大图片数量
    maxCount: {
      type: Number,
      value: 3
    },
    // 已选图片列表（本地临时路径）
    images: {
      type: Array,
      value: []
    }
  },

  data: {
    // 内部图片列表
    innerImages: []
  },

  observers: {
    // 监听外部 images 变化，同步到内部
    images: function (val) {
      this.setData({ innerImages: val || [] })
    }
  },

  methods: {
    // 选择图片（拍照或相册）
    chooseImage() {
      const remaining = this.data.maxCount - this.data.innerImages.length
      if (remaining <= 0) {
        wx.showToast({ title: `最多选择${this.data.maxCount}张图片`, icon: 'none' })
        return
      }

      wx.chooseMedia({
        count: remaining,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: (res) => {
          const newImages = res.tempFiles.map(file => file.tempFilePath)
          const merged = [...this.data.innerImages, ...newImages]
          this.setData({ innerImages: merged })
          // 通知父组件添加了图片
          this.triggerEvent('add', { images: newImages, allImages: merged })
        },
        fail: (err) => {
          // 用户取消选择时不提示
          if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
            wx.showToast({ title: '选择图片失败', icon: 'none' })
          }
        }
      })
    },

    // 删除图片
    deleteImage(e) {
      const index = e.currentTarget.dataset.index
      const images = [...this.data.innerImages]
      const removed = images.splice(index, 1)
      this.setData({ innerImages: images })
      // 通知父组件删除了图片
      this.triggerEvent('delete', { index, removedImage: removed[0], allImages: images })
    },

    // 预览图片
    previewImage(e) {
      const current = e.currentTarget.dataset.src
      wx.previewImage({
        current: current,
        urls: this.data.innerImages
      })
    }
  }
})
