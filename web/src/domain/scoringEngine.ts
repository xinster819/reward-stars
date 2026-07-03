// ScoringEngine 移植：纯函数、确定性；voided 事件在一切计算中排除。

import type { DailyScore, DateInterval, RedemptionRequest, ScoreEvent } from './types'
import { addDays, isSameDay, startOfDay, weekInterval } from './dates'

/** 余额 = Σ(非 voided 事件分) − Σ(approved 兑换花费)。可为负。 */
export function balance(events: ScoreEvent[], redemptions: RedemptionRequest[]): number {
  const earned = events.reduce((sum, e) => (e.isVoided ? sum : sum + e.points), 0)
  const spent = redemptions.reduce((sum, r) => (r.status === 'approved' ? sum + r.cost : sum), 0)
  return earned - spent
}

/** 累计获得：只算非 voided 且 points > 0 的事件（里程碑徽章用，永不因扣分/兑换回退）。 */
export function cumulativeEarned(events: ScoreEvent[]): number {
  return events.reduce((sum, e) => (!e.isVoided && e.points > 0 ? sum + e.points : sum), 0)
}

/** 区间净分：[start, end) 含头不含尾。 */
export function netPoints(events: ScoreEvent[], interval: DateInterval): number {
  return events.reduce((sum, e) => {
    if (e.isVoided) return sum
    if (e.timestamp >= interval.start && e.timestamp < interval.end) return sum + e.points
    return sum
  }, 0)
}

/** 当前周区间（默认周一起始）。 */
export function currentWeekInterval(now: Date, firstWeekday: number = 1): DateInterval {
  return weekInterval(now, firstWeekday)
}

/** 最近一条可撤销（非 voided）事件；时间戳最大者，同刻取后者（对位 Swift max(by:)）。 */
export function lastUndoableEvent(events: ScoreEvent[]): ScoreEvent | null {
  let latest: ScoreEvent | null = null
  for (const e of events) {
    if (e.isVoided) continue
    if (latest === null || e.timestamp.getTime() >= latest.timestamp.getTime()) latest = e
  }
  return latest
}

/** 最近事件：非 voided，按时间降序，取前 max(0, limit) 条。 */
export function recentEvents(events: ScoreEvent[], limit: number): ScoreEvent[] {
  return events
    .filter((e) => !e.isVoided)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, Math.max(0, limit))
}

/** 每日净分：最近 days 天（含 endingOn 当天），最旧在前；无事件的天 net=0 也占位。 */
export function dailyNetTotals(events: ScoreEvent[], days: number, endingOn: Date): DailyScore[] {
  if (days <= 0) return []
  const endDay = startOfDay(endingOn)
  const active = events.filter((e) => !e.isVoided)
  const result: DailyScore[] = []
  for (let offset = 0; offset < days; offset++) {
    const daysBack = days - 1 - offset
    // startOfDay 重归一化：跨「本地午夜不存在」的 DST 日时 addDays 会偏移到 01:00
    const dayStart = startOfDay(addDays(endDay, -daysBack))
    const net = active.reduce((sum, e) => (isSameDay(e.timestamp, dayStart) ? sum + e.points : sum), 0)
    result.push({ date: dayStart, net })
  }
  return result
}
