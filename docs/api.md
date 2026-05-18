# API 接口文档

本文档列出所有云函数的接口定义。所有接口通过 `services/api.js` 的 `callAPI(name, data)` 统一调用。

## 通用返回格式

```json
{
  "code": 0,        // 0=成功, -1=失败
  "message": "描述",
  "data": {}         // 返回数据
}
```

---

## 1. login - 用户登录注册

**功能描述**：获取用户 openid，查询或创建用户记录。首次调用自动注册。

**请求参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| （无） | | | openid 由云函数自动获取 |

**返回数据**：

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "_id": "xxx",
    "openid": "oXXXXXX",
    "nickname": "",
    "avatar": "",
    "totalPoints": 0,
    "reminderTime": "20:00",
    "reminderEnabled": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**调用示例**：
```javascript
const { callAPI } = require('../../services/api')
const res = await callAPI('login', {})
```

---

## 2. submitRecord - 提交记录

**功能描述**：统一提交各类记录，通过 `type` 字段区分。

### 2.1 type='checkin' - 练字打卡

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 "checkin" |
| photoUrl | string | 是 | 照片云存储 fileID |
| score | number | 否 | 字体评分 |
| comment | string | 否 | 评语 |
| date | string | 是 | 日期 YYYY-MM-DD |

**返回**：`{ code: 0, data: { earnedPoints: 10 } }`

### 2.2 type='mistake' - 添加错题

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 "mistake" |
| subject | string | 是 | 科目 |
| question | string | 是 | 题目内容 |
| answer | string | 否 | 答案 |
| photoUrl | string | 否 | 题目照片 fileID |

### 2.3 type='mistake_update' - 更新错题状态

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 "mistake_update" |
| mistakeId | string | 是 | 错题记录ID |
| solved | boolean | 是 | 是否已解决 |

### 2.4 type='mistake_delete' - 删除错题

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 "mistake_delete" |
| mistakeId | string | 是 | 错题记录ID |

### 2.5 type='copybook' - 保存字帖

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 "copybook" |
| articleId | string | 否 | 关联文章ID |
| fileID | string | 是 | 字帖图片 fileID |
| fontStyle | string | 否 | 字体风格，默认"楷书" |
| gridType | string | 否 | 格子类型，默认"田字格" |

### 2.6 type='updateSettings' - 更新设置

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 "updateSettings" |
| reminderEnabled | boolean | 否 | 是否开启提醒 |
| reminderTime | string | 否 | 提醒时间 HH:mm |

### 2.7 type='updateProfile' - 更新个人资料

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 "updateProfile" |
| nickname | string | 否 | 昵称 |
| avatar | string | 否 | 头像URL |

**调用示例**：
```javascript
const res = await callAPI('submitRecord', {
  type: 'checkin',
  photoUrl: 'cloud://xxx.jpg',
  score: 85,
  comment: '字迹工整',
  date: '2024-01-15'
})
```

---

## 3. getRecords - 获取记录

**功能描述**：统一查询各类记录，通过 `type` 字段区分。

### 3.1 type='today' - 获取今日记录

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 "today" |

**返回**：`{ code: 0, data: { checkedIn: true, record: {...}, totalPoints: 100 } }`

### 3.2 type='dashboard' - 获取仪表盘数据

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 "dashboard" |

**返回**：`{ code: 0, data: { todayCheckedIn, todayHasMistake, streakDays, totalPoints, checkedDates } }`

### 3.3 type='month' - 获取月度记录

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 "month" |
| year | number | 是 | 年份 |
| month | number | 是 | 月份 1-12 |

**返回**：`{ code: 0, data: { checkedDates, monthCheckins, streakDays, avgScore } }`

### 3.4 type='day' - 获取某日记录

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 "day" |
| date | string | 是 | 日期 YYYY-MM-DD |

### 3.5 type='mistakes' - 获取错题列表

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 "mistakes" |
| filter | string | 否 | "all"/"unsolved"/"solved" |

### 3.6 type='copybooks' - 获取字帖列表

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 "copybooks" |

### 3.7 type='stats' - 获取统计数据

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值 "stats" |

**返回**：`{ code: 0, data: { totalCheckins: 30 } }`

---

## 4. ocrRecognize - OCR识别

**功能描述**：调用百度OCR API识别图片中的文字。当前接口框架已预留，需配置API Key后激活。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| fileID | string | 是 | 云存储文件ID |

**返回**：
```json
{
  "code": -1,
  "message": "OCR服务尚未配置",
  "data": { "fileID": "xxx", "imageUrl": "https://xxx", "words": [] }
}
```

---

## 5. scoreCalligraphy - 字体评分

**功能描述**：对上传的练字图片进行评分。当前使用简化评分逻辑。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| fileID | string | 是 | 云存储文件ID |
| ocrResult | object | 否 | OCR识别结果 |

**返回**：
```json
{
  "code": 0,
  "data": {
    "score": 82,
    "comment": "字迹不错，继续保持！",
    "dimensions": {
      "neatness": 84,
      "standard": 80,
      "layout": 81
    }
  }
}
```

---

## 6. sendReminder - 发送提醒

**功能描述**：查询开启了提醒的用户，发送微信订阅消息。可配置为定时触发器。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| （无） | | | 查询所有 reminderEnabled=true 的用户 |

**返回**：`{ code: 0, data: { sentCount: 5 } }`

---

## 7. getPoints - 积分查询

**功能描述**：获取用户积分和积分记录。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| （无） | | | openid 自动获取 |

**返回**：
```json
{
  "code": 0,
  "data": {
    "totalPoints": 150,
    "streakDays": 5,
    "log": [
      { "points": 10, "description": "练字打卡", "type": "checkin", "createdAt": "..." }
    ]
  }
}
```

---

## 8. fetchArticles - 获取文章素材

**功能描述**：分页查询文章素材，支持分类筛选和关键词搜索。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| category | string | 否 | 分类：古诗词/散文/名言/课文 |
| keyword | string | 否 | 搜索关键词 |
| page | number | 否 | 页码，默认1 |

**返回**：
```json
{
  "code": 0,
  "data": [{ "_id": "xxx", "title": "静夜思", "content": "...", "category": "古诗词" }],
  "total": 50,
  "page": 1,
  "hasMore": true
}
```

---

## 9. generateCopybook - 生成字帖

**功能描述**：根据文章内容生成字帖图片。当前接口框架已预留。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| articleId | string | 是 | 文章素材ID |
| fontStyle | string | 否 | 字体风格，默认"楷书" |
| gridType | string | 否 | 格子类型，默认"田字格" |
| charsPerRow | number | 否 | 每行字数，默认8 |

**返回**：
```json
{
  "code": -1,
  "message": "字帖生成功能尚未实现",
  "data": { "articleId": "xxx", "fontStyle": "楷书", "gridType": "田字格", "fileID": "" }
}
```
