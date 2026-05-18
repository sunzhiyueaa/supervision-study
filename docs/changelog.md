# 更新日志

## v0.1.0 - 2026-05-18

### 初始化版本

**项目创建**：学习监督微信小程序 v0.1.0 初始化搭建完成。

### 新增功能

- **项目基础框架**
  - 初始化微信小程序项目结构（miniprogram/ + cloudfunctions/）
  - 配置 project.config.json（appid: wx1234567890abcdef）
  - 配置 app.js（云开发初始化）、app.json（页面路由+TabBar）、app.wxss（全局样式-绿色清新风格）
  - 创建 sitemap.json

- **页面结构（9个页面）**
  - 首页（pages/index）：今日任务+打卡入口+本周完成情况+快捷入口
  - 练字打卡（pages/checkin）：上传照片→OCR识别→评分→提交
  - 错题本（pages/mistakes）：添加/筛选/管理错题，支持照片上传
  - 日历记录（pages/calendar）：月历视图+打卡标记+统计概览+日期详情
  - 积分奖励（pages/rewards）：积分总览+规则说明+积分记录+功能入口（TabBar"我的"页）
  - 字帖素材（pages/copybook/articles）：搜索+分类筛选+文章列表（TabBar"字帖"页）
  - 字帖生成（pages/copybook/generate）：素材选择+字体/格子/字数配置+预览+保存
  - 已生成字帖（pages/copybook/gallery）：网格展示+图片预览
  - 设置（pages/settings）：练字提醒开关/时间+订阅消息+昵称修改+数据统计

- **公共组件（3个）**
  - calendar：可复用日历组件，支持已打卡日期标记
  - score-card：评分展示组件（环形分数+评语）
  - upload-photo：照片上传组件（拍照/选择+预览+删除）

- **服务层**
  - api.js：统一API层，支持云开发/独立后端切换
  - ocr.js：百度OCR服务封装（接口框架）
  - copybook.js：字帖服务封装

- **工具函数**
  - date.js：日期格式化、获取星期、获取本周日期列表
  - auth.js：登录态管理（内存缓存+本地存储+自动登录）

- **云函数（9个）**
  - login：用户登录注册（获取openid，查询或创建用户）
  - submitRecord：统一提交记录（打卡/错题/字帖/设置/资料更新）
  - getRecords：统一查询记录（今日/仪表盘/月度/日/错题/字帖/统计）
  - ocrRecognize：OCR识别（百度OCR接口框架）
  - scoreCalligraphy：字体评分（简化评分逻辑）
  - sendReminder：发送练字提醒（微信订阅消息框架）
  - getPoints：积分查询（积分记录+连续打卡天数）
  - fetchArticles：获取文章素材（分页/分类/搜索）
  - generateCopybook：生成字帖（接口框架）

- **数据库集合（6个）**
  - users：用户信息（简化版，无角色字段）
  - daily_records：每日记录（打卡+错题）
  - reminders：提醒设置
  - points_log：积分日志
  - copybook_articles：字帖文章素材
  - copybook_generated：已生成字帖

- **设计文档**
  - docs/design.md：整体设计文档
  - docs/api.md：API接口文档
  - docs/database.md：数据库文档
  - docs/changelog.md：更新日志

### 架构决策

- **统一界面设计**：取消角色分离（家长端/学生端），采用统一界面。原因：用户弟弟没有手机，与妈妈共用同一微信号。
- **可迁移设计**：API层支持云开发/独立后端切换，降低迁移成本。
- **CommonJS模块**：使用 require/module.exports，不使用 ES module。
- **rpx单位**：全局使用rpx，适配不同屏幕尺寸。
