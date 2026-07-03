// 日历工具：对位 Swift Calendar 的 startOfDay / addDays / isSameDay / weekInterval。
// 全部按【本地时区】计算（对位 iOS Calendar.current）；周起始默认周一（对位测试 firstWeekday=2）。

import type { DateInterval } from './types'

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, days: number): Date {
  // 用「日期分量 + n 天」构造，跨 DST 也落在正确的日历日 00:00 / 对应时刻
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds())
}

export function addHours(d: Date, hours: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + hours, d.getMinutes(), d.getSeconds(), d.getMilliseconds())
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * 当前周区间 [start, end)。firstWeekday：1=周一 … 7=周日（默认周一，
 * 对位 iOS 测试 Calendar.firstWeekday = 2 的语义）。
 */
export function weekInterval(now: Date, firstWeekday: number = 1): DateInterval {
  const day = startOfDay(now)
  // JS getDay(): 0=周日…6=周六 → 换算成 1=周一…7=周日
  const isoDay = day.getDay() === 0 ? 7 : day.getDay()
  const diff = (isoDay - firstWeekday + 7) % 7
  const start = addDays(day, -diff)
  const end = addDays(start, 7)
  return { start, end }
}
