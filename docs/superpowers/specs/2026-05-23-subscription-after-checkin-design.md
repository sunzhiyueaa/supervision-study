# 打卡后订阅提醒设计

## 背景

当前小程序使用微信一次性订阅消息模板（`wUNI9FwYhbLe5rwqn9PdlPdbOPyLG2_GcX_LfzEBGrU`）。一次性模板每次 `wx.requestSubscribeMessage` 只能授权发送一条消息，发送后权限即消耗。因此需要每天重新订阅才能保证次日提醒正常发送。

现有问题：
- 用户可能忘记去设置页订阅，导致提醒发不出去
- 需要在用户最有意愿的时刻（打卡成功后）引导订阅

## 设计方案

### 1. 打卡成功后弹出自定义订阅弹窗

**触发时机：** `pages/checkin/index.js` 的 `submitCheckin` 方法成功后

**弹窗行为：**
- 打卡成功 → confetti 动画 + toast "打卡成功！"
- 动画结束后弹出自定义弹窗

**弹窗内容：**
- 标题：明日提醒订阅
- 正文：打卡成功！订阅提醒，明天继续坚持练字
- 状态判断：
  - 今天已订阅 → 显示"已订阅 ✓"（灰色不可点）+ "知道了"按钮
  - 今天未订阅 → 显示"去订阅"（绿色可点）+ "稍后再说"按钮

**交互：**
- 点"去订阅" → 调用 `wx.requestSubscribeMessage` → 成功后更新状态为已订阅，弹窗内容变为"已订阅 ✓"
- 点"稍后再说"/"知道了" → 关闭弹窗

**实现方式：** 在 checkin 页面使用 WXML 自定义弹窗（不用 `wx.showModal`，因为需要动态更新按钮状态）

### 2. 订阅状态追踪

**存储方式：** `wx.setStorageSync('subscribeToday_YYYY-MM-DD', true)`

- key 包含日期，每天自动"重置"（新日期的 key 不存在）
- 订阅成功时写入当天日期的 key
- 进入打卡页时读取当天 key 判断状态

**为什么每天重置：** 一次性模板每条消息消耗一次权限，今天的订阅权限被今天的提醒消耗后，明天需要重新订阅。

### 3. 设置页（保持不变）

- 保留时间选择器（真机正常，模拟器不响应鼠标点击是已知问题）
- 保留"去订阅"按钮作为补充入口
- 保留提醒规则说明

### 4. 首页引导条（保持不变）

- 条件：已登录 + 未开启提醒 + 今天没关闭过提示 → 显示引导条
- 现有逻辑不变

### 5. 云函数 `sendReminder` 调整

**新增检查：** 发送前检查用户的 `subscribedDate` 是否为今天
- 不是今天 → 跳过（用户今天没有订阅，没有发送权限）
- 是今天 → 发送，发送成功后清除 `subscribedDate`

**用户数据结构变化：**
- `users` 集合新增字段 `subscribedDate`（string，格式 `YYYY-MM-DD`）
- 前端订阅成功时通过 `submitRecord` 云函数写入

## 数据流

```
用户点击打卡按钮
  → submitCheckin() 上传图片 + 调用 submitRecord
  → 打卡成功，显示 confetti + toast
  → 弹出自定义订阅弹窗
  → 用户点击"去订阅"
  → wx.requestSubscribeMessage()
  → 成功 → wx.setStorageSync('subscribeToday_2026-05-23', true)
  → 调用 submitRecord({ type: 'updateSubscribeDate', subscribedDate: '2026-05-23' })
  → 更新 users 集合的 subscribedDate 字段
  → 弹窗显示"已订阅 ✓"

--- 定时触发 sendReminder ---
  → 查询 reminderEnabled: true 的用户
  → 检查 subscribedDate === today
  → 不匹配 → 跳过
  → 匹配 → 检查是否已打卡 → 未打卡 → 发送提醒
  → 发送成功 → 清除 subscribedDate
```

## 涉及文件

| 文件 | 变更 |
|------|------|
| `miniprogram/pages/checkin/index.js` | 新增订阅弹窗逻辑、订阅状态检查、调用订阅 API |
| `miniprogram/pages/checkin/index.wxml` | 新增自定义弹窗 UI |
| `miniprogram/pages/checkin/index.wxss` | 新增弹窗样式 |
| `cloudfunctions/submitRecord/index.js` | 新增 `updateSubscribeDate` 类型处理 |
| `cloudfunctions/sendReminder/index.js` | 新增 `subscribedDate` 检查逻辑 |

## 不变的部分

- 设置页：时间选择器 + "去订阅"按钮 + 提醒规则说明
- 首页：引导条逻辑
- 模板 ID：`wUNI9FwYhbLe5rwqn9PdlPdbOPyLG2_GcX_LfzEBGrU`
