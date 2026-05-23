# 数据库文档

本文档定义学习监督小程序的所有数据库集合。数据库使用微信云开发云数据库。

---

## 1. users - 用户信息

**用途**：存储用户基本信息和设置。统一界面，不区分角色。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| _id | string | 否 | 自动生成 | 文档ID |
| openid | string | 是 | - | 微信用户唯一标识 |
| nickname | string | 否 | "" | 用户昵称 |
| avatar | string | 否 | "" | 头像URL |
| totalPoints | number | 否 | 0 | 累计积分 |
| reminderTime | string | 否 | "20:00" | 每日提醒时间（HH:mm） |
| reminderEnabled | boolean | 否 | false | 是否开启每日提醒 |
| createdAt | date | 否 | serverDate() | 创建时间 |

**索引设计**：

| 索引名 | 字段 | 唯一 | 说明 |
|--------|------|------|------|
| openid_index | openid | 是 | 按openid快速查询用户 |

**数据示例**：
```json
{
  "_id": "user001",
  "openid": "oXXXXXXXXXXXXXXXX",
  "nickname": "小明",
  "avatar": "cloud://avatar/001.jpg",
  "totalPoints": 150,
  "reminderTime": "20:00",
  "reminderEnabled": true,
  "createdAt": "2024-01-15T08:00:00.000Z"
}
```

---

## 2. daily_records - 每日记录

**用途**：存储练字打卡和错题记录，通过 `type` 字段区分。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| _id | string | 否 | 自动生成 | 文档ID |
| openid | string | 是 | - | 所属用户openid |
| type | string | 是 | - | 记录类型：checkin / mistake |
| date | string | 否 | - | 打卡日期 YYYY-MM-DD（checkin专用） |
| photoUrl | string | 否 | - | 照片云存储fileID |
| score | number | 否 | 0 | 字体评分（checkin专用） |
| comment | string | 否 | "" | 评分评语（checkin专用） |
| earnedPoints | number | 否 | 0 | 获得积分（checkin专用） |
| subject | string | 否 | - | 科目（mistake专用） |
| question | string | 否 | - | 题目内容（mistake专用） |
| answer | string | 否 | "" | 答案（mistake专用） |
| solved | boolean | 否 | false | 是否已解决（mistake专用） |
| createdAt | date | 否 | serverDate() | 创建时间 |

**索引设计**：

| 索引名 | 字段 | 唯一 | 说明 |
|--------|------|------|------|
| openid_date_type | openid, date, type | 否 | 查询用户某日某类型记录 |
| openid_type_date | openid, type, date | 否 | 按类型和日期范围查询 |

**数据示例 - 打卡记录**：
```json
{
  "_id": "record001",
  "openid": "oXXXXXXXXXXXXXXXX",
  "type": "checkin",
  "date": "2024-01-15",
  "photoUrl": "cloud://checkin/20240115_xxx.jpg",
  "score": 85,
  "comment": "字迹工整，识别度高，非常棒！",
  "earnedPoints": 15,
  "createdAt": "2024-01-15T20:30:00.000Z"
}
```

**数据示例 - 错题记录**：
```json
{
  "_id": "record002",
  "openid": "oXXXXXXXXXXXXXXXX",
  "type": "mistake",
  "subject": "数学",
  "question": "求函数f(x)=x²+2x-3的零点",
  "answer": "x=1或x=-3",
  "photoUrl": "cloud://mistakes/xxx.jpg",
  "solved": false,
  "createdAt": "2024-01-15T21:00:00.000Z"
}
```

---

## 3. reminders - 提醒设置

**用途**：存储订阅消息相关数据。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| _id | string | 否 | 自动生成 | 文档ID |
| openid | string | 是 | - | 所属用户openid |
| templateId | string | 否 | - | 订阅消息模板ID |
| subscribed | boolean | 否 | false | 是否已订阅 |
| lastSentAt | date | 否 | - | 最后一次发送提醒的时间 |
| createdAt | date | 否 | serverDate() | 创建时间 |

**索引设计**：

| 索引名 | 字段 | 唯一 | 说明 |
|--------|------|------|------|
| openid_index | openid | 否 | 按用户查询提醒设置 |

**数据示例**：
```json
{
  "_id": "reminder001",
  "openid": "oXXXXXXXXXXXXXXXX",
  "templateId": "tmplXXXXXX",
  "subscribed": true,
  "lastSentAt": "2024-01-15T20:00:00.000Z",
  "createdAt": "2024-01-10T10:00:00.000Z"
}
```

---

## 4. points_log - 积分日志

**用途**：记录所有积分变动，用于积分明细展示。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| _id | string | 否 | 自动生成 | 文档ID |
| openid | string | 是 | - | 所属用户openid |
| points | number | 是 | - | 积分变动值（正/负） |
| description | string | 是 | - | 变动描述 |
| type | string | 是 | - | 类型：checkin/mistake/streak_bonus/other |
| createdAt | date | 否 | serverDate() | 创建时间 |

**索引设计**：

| 索引名 | 字段 | 唯一 | 说明 |
|--------|------|------|------|
| openid_createdAt | openid, createdAt | 否 | 按用户和时间查询积分记录 |

**数据示例**：
```json
{
  "_id": "points001",
  "openid": "oXXXXXXXXXXXXXXXX",
  "points": 10,
  "description": "练字打卡",
  "type": "checkin",
  "createdAt": "2024-01-15T20:30:00.000Z"
}
```

---

## 5. copybook_articles - 字帖文章素材

**用途**：存储可供练字的古诗词、散文等文章素材。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| _id | string | 否 | 自动生成 | 文档ID |
| title | string | 是 | - | 文章标题 |
| content | string | 是 | - | 文章完整内容 |
| excerpt | string | 否 | - | 文章摘要 |
| category | string | 是 | - | 分类：古诗词/散文/名言/课文 |
| author | string | 否 | - | 作者 |
| source | string | 否 | - | 来源 |
| charCount | number | 否 | - | 字符数 |
| createdAt | date | 否 | serverDate() | 创建时间 |

**索引设计**：

| 索引名 | 字段 | 唯一 | 说明 |
|--------|------|------|------|
| category_index | category | 否 | 按分类查询 |
| title_index | title | 否 | 按标题搜索 |

**数据示例**：
```json
{
  "_id": "article001",
  "title": "静夜思",
  "content": "床前明月光，疑是地上霜。举头望明月，低头思故乡。",
  "excerpt": "床前明月光，疑是地上霜...",
  "category": "古诗词",
  "author": "李白",
  "source": "唐诗三百首",
  "charCount": 20,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

## 6. copybook_generated - 已生成字帖

**用途**：存储用户生成并保存的字帖记录。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| _id | string | 否 | 自动生成 | 文档ID |
| openid | string | 是 | - | 所属用户openid |
| articleId | string | 否 | - | 关联的文章素材ID |
| fileID | string | 是 | - | 字帖图片云存储fileID |
| fontStyle | string | 否 | "楷书" | 字体风格：楷书/行书/隶书/篆书 |
| gridType | string | 否 | "田字格" | 格子类型：田字格/米字格/回宫格/无格 |
| createdAt | date | 否 | serverDate() | 创建时间 |

**索引设计**：

| 索引名 | 字段 | 唯一 | 说明 |
|--------|------|------|------|
| openid_createdAt | openid, createdAt | 否 | 按用户和时间查询已生成字帖 |

**数据示例**：
```json
{
  "_id": "copybook001",
  "openid": "oXXXXXXXXXXXXXXXX",
  "articleId": "article001",
  "fileID": "cloud://copybook/xxx.jpg",
  "fontStyle": "楷书",
  "gridType": "田字格",
  "createdAt": "2024-01-15T19:00:00.000Z"
}
```

---

## 7. user_fonts - 用户自定义字体

**用途**：存储用户上传的自定义字体文件信息。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| _id | string | 否 | 自动生成 | 文档ID |
| openid | string | 是 | - | 所属用户openid |
| fileName | string | 是 | - | 字体名称（从文件名提取，去掉.ttf后缀） |
| fileID | string | 是 | - | 云存储文件ID（cloud://...） |
| fileSize | number | 否 | 0 | 文件大小（字节） |
| createdAt | date | 否 | serverDate() | 上传时间 |

**索引设计**：

| 索引名 | 字段 | 唯一 | 说明 |
|--------|------|------|------|
| openid_createdAt | openid, createdAt | 否 | 按用户和时间查询字体 |

**数据示例**：
```json
{
  "_id": "font001",
  "openid": "oXXXXXXXXXXXXXXXX",
  "fileName": "荆霄鹏",
  "fileID": "cloud://xxx/fonts/oXXX/1716460800000-荆霄鹏.ttf",
  "fileSize": 12845056,
  "createdAt": "2026-05-23T10:00:00.000Z"
}
```
