// 云函数 initCourseLessons - 初始化课程数据（一次性执行）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 五阶素材库37课完整数据
const LESSONS = [
  // 阶段一：控笔与基本笔画（8课）
  { stage: 1, stageName: '控笔与基本笔画', lessonNo: 1, title: '长横与短横', tips: '长横起笔稍顿，行笔轻快，收笔加重，整体呈左低右高之势，弧度为微微上拱。短横用力均匀，写得短促饱满。', demoChars: '一、二、三', practiceSlots: 10 },
  { stage: 1, stageName: '控笔与基本笔画', lessonNo: 2, title: '悬针竖与垂露竖', tips: '悬针竖尾巴出尖，书写时要缓缓提笔；垂露竖收笔回锋，尾部圆润如露珠。二者都要写得挺拔正直。', demoChars: '十、干、丰', practiceSlots: 10 },
  { stage: 1, stageName: '控笔与基本笔画', lessonNo: 3, title: '斜撇与竖撇', tips: '斜撇要写得舒展，起笔重，由重到轻快速撇出，末尾出锋。竖撇先竖后撇，如"月"字撇。', demoChars: '人、左、月', practiceSlots: 10 },
  { stage: 1, stageName: '控笔与基本笔画', lessonNo: 4, title: '斜捺与平捺', tips: '捺画一波三折，轻起笔，向右下渐行渐重，至捺脚处稍顿，再水平向右出锋。平捺见于"之"字，角度更平。', demoChars: '大、之、这', practiceSlots: 10 },
  { stage: 1, stageName: '控笔与基本笔画', lessonNo: 5, title: '竖钩与弯钩', tips: '竖钩在竖画末端向左上快速钩出，钩不宜过大。弯钩多用于反犬旁，弯中求正，重心要稳。', demoChars: '小、可、狂', practiceSlots: 10 },
  { stage: 1, stageName: '控笔与基本笔画', lessonNo: 6, title: '横折与竖折', tips: '横折的转折处需顿笔，形成方肩。竖折则是竖画结束后笔不离纸，向右行笔写横，转折处圆转中带方。', demoChars: '口、山、区', practiceSlots: 10 },
  { stage: 1, stageName: '控笔与基本笔画', lessonNo: 7, title: '提画与点画', tips: '提画重起轻收，迅速向右上方挑出。点画虽小，要有起笔、行笔、收笔动作，写出饱满的"三角一肚"。', demoChars: '冷、江、照', practiceSlots: 10 },
  { stage: 1, stageName: '控笔与基本笔画', lessonNo: 8, title: '复合笔画的连贯', tips: '横撇、横折钩、竖折折钩等复合笔画，讲究转折处的提按过渡。不能生硬停顿，要气息连贯。', demoChars: '又、九、弓', practiceSlots: 10 },

  // 阶段二：高频偏旁部首（10课）
  { stage: 2, stageName: '高频偏旁部首', lessonNo: 9, title: '单人旁与双人旁', tips: '单人旁撇画稍斜，竖画起笔在撇的中部。双人旁两撇指向不同，第二撇起笔偏左，竖画对准第二撇中间。', demoChars: '仁、休、行、德', practiceSlots: 10 },
  { stage: 2, stageName: '高频偏旁部首', lessonNo: 10, title: '三点水与言字旁', tips: '三点水呈弧形排列，第二点稍左，上两点间距小，下提点呼应右部。言字旁横折提要注意折角顿笔，整体偏窄。', demoChars: '河、海、说、话', practiceSlots: 10 },
  { stage: 2, stageName: '高频偏旁部首', lessonNo: 11, title: '木字旁与禾木旁', tips: '作为偏旁时横画左伸右缩，捺变为点，以让右。竖画要垂直穿过横画偏右位置。', demoChars: '林、松、和、程', practiceSlots: 10 },
  { stage: 2, stageName: '高频偏旁部首', lessonNo: 12, title: '草字头与竹字头', tips: '草字头两竖上开下合，横画被两竖三等分。竹字头左右同形，但左小右大，撇点呼应。', demoChars: '花、草、笑、答', practiceSlots: 10 },
  { stage: 2, stageName: '高频偏旁部首', lessonNo: 13, title: '宝盖头与穴宝盖', tips: '首点居中，左点与横钩要断开，横钩的钩指向下一个字。穴宝盖下面的"八"要内收。', demoChars: '安、宝、空、穿', practiceSlots: 10 },
  { stage: 2, stageName: '高频偏旁部首', lessonNo: 14, title: '走之底与建之旁', tips: '走之底的点与下部的横折折撇距离要小，捺画伸展托住上方。建之旁第一笔横折折撇要内收，捺画稍平。', demoChars: '过、道、廷、建', practiceSlots: 10 },
  { stage: 2, stageName: '高频偏旁部首', lessonNo: 15, title: '心字底与皿字底', tips: '心字底卧钩要写出弧度，钩尖指向中心，三点呼应。皿字底横长托上，两侧竖画内收。', demoChars: '思、想、孟、盘', practiceSlots: 10 },
  { stage: 2, stageName: '高频偏旁部首', lessonNo: 16, title: '反文旁与欠字旁', tips: '反文旁撇横要收敛，第三笔撇画稍弯曲，捺画舒展。欠字旁上紧下松，下部"人"要支撑有力。', demoChars: '故、教、歌、欢', practiceSlots: 10 },
  { stage: 2, stageName: '高频偏旁部首', lessonNo: 17, title: '月字旁与舟字旁', tips: '月字旁要写得窄而高，里面的两横不与右竖连死。舟字旁同理，注意做偏旁时横不出头过长。', demoChars: '明、服、船、般', practiceSlots: 10 },
  { stage: 2, stageName: '高频偏旁部首', lessonNo: 18, title: '衣补旁与示补旁', tips: '这两个偏旁极易混淆。示补旁右边是一点，衣补旁是两点。书写时都要注意点、横撇的断开与呼应。', demoChars: '祖、礼、被、袜', practiceSlots: 10 },

  // 阶段三：间架结构黄金法则（10课）
  { stage: 3, stageName: '间架结构黄金法则', lessonNo: 19, title: '横平竖直', tips: '横不是绝对水平，而是7-10度上斜；竖画在任何位置都要垂直，支撑字形。', demoChars: '书、章、申、华', practiceSlots: 10 },
  { stage: 3, stageName: '间架结构黄金法则', lessonNo: 20, title: '主笔突出', tips: '每个字都有一个最舒展的笔画，要放开写；其他笔画适当收紧。', demoChars: '成、武、春、千', practiceSlots: 10 },
  { stage: 3, stageName: '间架结构黄金法则', lessonNo: 21, title: '上紧下松', tips: '上部笔画紧凑，下部笔画疏朗，重心在上，字形才挺拔。', demoChars: '是、走、方、秀', practiceSlots: 10 },
  { stage: 3, stageName: '间架结构黄金法则', lessonNo: 22, title: '左紧右松', tips: '左右结构，通常左边要收紧，右边要放展，左让右。', demoChars: '林、从、北、比', practiceSlots: 10 },
  { stage: 3, stageName: '间架结构黄金法则', lessonNo: 23, title: '内紧外松', tips: '包围或半包围结构，内部要紧凑，外框要稳健，外框的大小决定字的大小。', demoChars: '国、画、幽、周', practiceSlots: 10 },
  { stage: 3, stageName: '间架结构黄金法则', lessonNo: 24, title: '多横等距', tips: '字内有多个横画时，间距大致相等，且长短参差，切忌雷同。', demoChars: '其、直、星、善', practiceSlots: 10 },
  { stage: 3, stageName: '间架结构黄金法则', lessonNo: 25, title: '点竖直对', tips: '上下结构的字，上部的点与下部的竖画应在一条中线上，重心才能对齐。', demoChars: '永、家、常、安', practiceSlots: 10 },
  { stage: 3, stageName: '间架结构黄金法则', lessonNo: 26, title: '裙不落地', tips: '上下结构，当上部有撇捺时，下部的部件要往上靠，不能脱节。', demoChars: '金、食、今、全', practiceSlots: 10 },
  { stage: 3, stageName: '间架结构黄金法则', lessonNo: 27, title: '借让避就', tips: '部件之间要注意穿插，一笔画可稍微伸入对方空白区域，使字更紧密。', demoChars: '妙、难、秋、鸦', practiceSlots: 10 },
  { stage: 3, stageName: '间架结构黄金法则', lessonNo: 28, title: '同形相并', tips: '左右同形，左小右大；上下同形，上小下大。相同部件要有变化。', demoChars: '竹、朋、吕、昌', practiceSlots: 10 },

  // 阶段四：高考易错高频字实战（5课）
  { stage: 4, stageName: '高考易错高频字实战', lessonNo: 29, title: '易糊字训练（一）', tips: '这些字笔画多，关键在于"均分空间，主笔突出"。例如"餐"的撇捺要舒展，"鼻"的上部要紧缩。', demoChars: '餐、勇、蠢、鼻、察、幽、繁、赢、瓣、辩', practiceSlots: 10 },
  { stage: 4, stageName: '高考易错高频字实战', lessonNo: 30, title: '易倒字训练（二）', tips: '重心不稳的字，要多检查撇捺的交叉点是否与竖中线重合，底部支撑点是否到位。', demoChars: '家、象、夜、夏、卷、苍、昏、黎、攀、碧', practiceSlots: 10 },
  { stage: 4, stageName: '高考易错高频字实战', lessonNo: 31, title: '易窄字训练（三）', tips: '斜钩和竖弯钩是难点，卧钩和斜钩一定要写出曲度，骨字框和风字框要挺拔。', demoChars: '骨、周、风、凤、鼠、舅、戴、裁、武、式', practiceSlots: 10 },
  { stage: 4, stageName: '高考易错高频字实战', lessonNo: 32, title: '易分家字训练（四）', tips: '左右结构切勿分太开，左旁的末笔要写短，右旁的第一笔尽量向左穿插。', demoChars: '知、和、唯、明、鸿、雅、版、即、却、部', practiceSlots: 10 },
  { stage: 4, stageName: '高考易错高频字实战', lessonNo: 33, title: '易写长字训练（五）', tips: '字形偏长的字，横画宜短，竖画宜长，宽窄比例控制在3:5左右，避免写成正方形。', demoChars: '身、事、青、常、掌、寿、囊、重、意、竞', practiceSlots: 10 },

  // 阶段五：实用篇章书写（4课）
  { stage: 5, stageName: '实用篇章书写', lessonNo: 34, title: '名言警句', tips: '字的大小占横线格三分之二，字距均匀，标点不贴字。', demoChars: '天行健君子以自强不息', practiceSlots: 10 },
  { stage: 5, stageName: '实用篇章书写', lessonNo: 35, title: '《劝学》节选', tips: '遇到"跬""骐骥""锲"等复杂字，稍微放慢，先把结构写稳；整体行气靠字的中心对齐。', demoChars: '故不积跬步无以至千里', practiceSlots: 10 },
  { stage: 5, stageName: '实用篇章书写', lessonNo: 36, title: '《琵琶行》经典段落', tips: '注意诗句的节奏感，每句字数一致，保持行气流畅。', demoChars: '千呼万唤始出来犹抱琵琶半遮面', practiceSlots: 10 },
  { stage: 5, stageName: '实用篇章书写', lessonNo: 37, title: '现代文优美段落', tips: '在答题卡上书写此类段落时，先快速想好断句，每行开头平齐，结尾尽量少留空白，保持视觉整齐。', demoChars: '我们曾如此渴望命运的波澜', practiceSlots: 10 }
]

exports.main = async (event, context) => {
  try {
    // 检查是否已初始化
    const countRes = await db.collection('course_lessons').count()
    if (countRes.total > 0) {
      return { code: 0, message: '课程数据已存在，无需初始化', data: { count: countRes.total } }
    }

    // 批量写入
    const promises = LESSONS.map(lesson => {
      return db.collection('course_lessons').add({
        data: {
          ...lesson,
          createdAt: db.serverDate()
        }
      })
    })

    await Promise.all(promises)
    return { code: 0, message: '初始化成功', data: { count: LESSONS.length } }
  } catch (err) {
    console.error('初始化课程数据失败:', err)
    return { code: -1, message: '初始化失败: ' + err.message }
  }
}
