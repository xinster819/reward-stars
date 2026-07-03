// StreakCalculator 移植：连续「净分 > 0」天数；净 0 / 负 / 缺天 / 全 voided 都断连。

import type { ScoreEvent } from './types'
import { addDays, startOfDay } from './dates'

export function currentStreak(events: ScoreEvent[], asOf: Date): number {
  const netByDay = new Map<number, number>()
  for (const e of events) {
    if (e.isVoided) continue
    const key = startOfDay(e.timestamp).getTime()
    netByDay.set(key, (netByDay.get(key) ?? 0) + e.points)
  }

  let streak = 0
  let cursor = startOfDay(asOf)
  while ((netByDay.get(cursor.getTime()) ?? 0) > 0 && netByDay.has(cursor.getTime())) {
    streak += 1
    // 再套一层 startOfDay：极端时区（如智利）本地午夜可能不存在，addDays 会落在 01:00，
    // 必须重归一化才能与 netByDay 的 key（各天 startOfDay）对得上
    cursor = startOfDay(addDays(cursor, -1))
  }
  return streak
}
