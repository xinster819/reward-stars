// SampleData 移植：确定性示例数据（注入 now），名称为领域中文（seed 时经 i18n 本地化）。

import type { BehaviorRule, ChildProfile, Reward, SampleBundle, ScoreCategory, ScoreEvent, UUID } from './types'
import { SAMPLE_CHILD_ID, newUUID } from './types'
import { addDays, addHours, startOfDay } from './dates'

export function makeSampleBundle(now: Date = new Date(), childID: UUID = SAMPLE_CHILD_ID): SampleBundle {
  const child: ChildProfile = {
    id: childID,
    name: '小明',
    avatarSymbol: 'teddybear.fill',
    createdAt: addDays(now, -30),
  }

  const mkRule = (
    name: string, category: ScoreCategory, points: number, iconName: string, sortOrder: number,
  ): BehaviorRule => ({
    id: newUUID(), name, details: null, category, points, iconName,
    isActive: true, sortOrder, createdAt: addDays(now, -30), childID,
  })

  const rHomework = mkRule('认真完成作业', 'learning', 10, 'pencil.and.ruler.fill', 0)
  const rReading = mkRule('主动阅读 30 分钟', 'learning', 8, 'book.fill', 1)
  const rTidy = mkRule('自己整理房间', 'life', 5, 'bed.double.fill', 2)
  const rRoutine = mkRule('按时起床睡觉', 'life', 5, 'alarm.fill', 3)
  const rChores = mkRule('帮忙做家务', 'life', 6, 'hands.sparkles.fill', 4)
  const rPolite = mkRule('有礼貌、主动分享', 'character', 6, 'heart.fill', 5)
  const rDelay = mkRule('拖延磨蹭', 'learning', -5, 'tortoise.fill', 6)
  const rTalkBack = mkRule('顶撞父母', 'character', -8, 'exclamationmark.bubble.fill', 7)
  const rOther = mkRule('其他好表现', 'other', 4, 'star.fill', 8)
  const rules = [rHomework, rReading, rTidy, rRoutine, rChores, rPolite, rDelay, rTalkBack, rOther]

  const mkReward = (name: string, cost: number, iconName: string, sortOrder: number): Reward => ({
    id: newUUID(), name, cost, iconName, isActive: true, sortOrder, createdAt: addDays(now, -30), childID,
  })
  const rewards = [
    mkReward('看 30 分钟电视', 20, 'tv.fill', 0),
    mkReward('玩 30 分钟游戏', 25, 'gamecontroller.fill', 1),
    mkReward('一支冰淇淋', 15, 'birthday.cake.fill', 2),
    mkReward('挑一本新书', 40, 'books.vertical.fill', 3),
    mkReward('周末去公园', 50, 'tree.fill', 4),
  ]

  const today = startOfDay(now)
  const ev = (rule: BehaviorRule, daysAgo: number, hour: number, note: string | null = null): ScoreEvent => {
    let ts = addHours(addDays(today, -daysAgo), hour)
    if (ts > now) ts = new Date(now.getTime() - hour * 60 * 1000)
    return {
      id: newUUID(), ruleID: rule.id, ruleName: rule.name, category: rule.category,
      points: rule.points, note, timestamp: ts, childID, isVoided: false,
    }
  }

  // 7 天每天净分为正 → 连击 7；累计获得 79
  const events = [
    ev(rHomework, 6, 19), ev(rTidy, 6, 20),
    ev(rReading, 5, 18),
    ev(rDelay, 4, 17, '作业拖到很晚'), ev(rChores, 4, 19),
    ev(rHomework, 3, 19),
    ev(rPolite, 2, 9, '主动和邻居打招呼'), ev(rRoutine, 2, 21),
    ev(rHomework, 1, 19), ev(rReading, 1, 20),
    ev(rTidy, 0, 8), ev(rChores, 0, 18, '帮忙摆碗筷'),
  ]

  return { child, rules, rewards, events, redemptions: [] }
}
