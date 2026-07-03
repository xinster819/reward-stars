import { describe, expect, it } from 'vitest'
import { balance, cumulativeEarned, currentWeekInterval, dailyNetTotals, lastUndoableEvent, netPoints, recentEvents } from '../scoringEngine'
import { CHILD, d, ev, redemption } from './helpers'

describe('ScoringEngine', () => {
  it('balance sums active events minus approved redemptions', () => {
    const events = [
      ev(10, d(2024, 1, 1, 9)),
      ev(-5, d(2024, 1, 1, 10)),
      ev(8, d(2024, 1, 2, 9), { isVoided: true }), // voided 忽略
    ]
    const redemptions = [
      redemption(4, 'approved', d(2024, 1, 2, 12)),
      redemption(99, 'pending', d(2024, 1, 2, 13)), // 不扣
      redemption(99, 'rejected', d(2024, 1, 2, 14)), // 不扣
    ]
    expect(balance(events, redemptions)).toBe(10 - 5 - 4)
    expect(balance([], [])).toBe(0)
  })

  it('cumulativeEarned counts only positive active events', () => {
    const events = [
      ev(10, d(2024, 1, 1)),
      ev(-5, d(2024, 1, 2)), // 负分不计
      ev(0, d(2024, 1, 3)), // 0 分不计
      ev(7, d(2024, 1, 4), { isVoided: true }), // voided 不计
      ev(3, d(2024, 1, 5)),
    ]
    expect(cumulativeEarned(events)).toBe(13)
  })

  it('netPoints within [start, end) interval', () => {
    const start = d(2024, 1, 1)
    const end = d(2024, 1, 8)
    const events = [
      ev(5, start), // 含头
      ev(3, d(2024, 1, 4)),
      ev(2, end), // 不含尾
      ev(9, d(2023, 12, 31, 23, 59)), // 区间前
      ev(-4, d(2024, 1, 6), { isVoided: true }), // voided
    ]
    expect(netPoints(events, { start, end })).toBe(8)
  })

  it('lastUndoableEvent skips voided and picks most recent', () => {
    const target = ev(3, d(2024, 1, 3, 10))
    const events = [
      ev(1, d(2024, 1, 1, 10)),
      target,
      ev(9, d(2024, 1, 5, 10), { isVoided: true }), // 更晚但已 voided
    ]
    expect(lastUndoableEvent(events)?.id).toBe(target.id)
  })

  it('lastUndoableEvent null when all voided', () => {
    expect(lastUndoableEvent([ev(1, d(2024, 1, 1), { isVoided: true })])).toBeNull()
    expect(lastUndoableEvent([])).toBeNull()
  })

  it('recentEvents sorted desc and limited', () => {
    const e1 = ev(1, d(2024, 1, 1))
    const e2 = ev(2, d(2024, 1, 2))
    const e3 = ev(3, d(2024, 1, 3))
    const voided = ev(4, d(2024, 1, 4), { isVoided: true })
    const result = recentEvents([e1, e3, voided, e2], 2)
    expect(result.map((e) => e.id)).toEqual([e3.id, e2.id])
    expect(recentEvents([e1], -1)).toEqual([])
  })

  it('currentWeekInterval is Monday-based with 7-day duration', () => {
    // 2024-01-01 是周一
    const monday = d(2024, 1, 1, 15)
    const week = currentWeekInterval(monday)
    expect(week.start).toEqual(d(2024, 1, 1))
    expect(week.end).toEqual(d(2024, 1, 8))
    // 周日也归属同一周（周一起始）
    const sunday = d(2024, 1, 7, 8)
    const week2 = currentWeekInterval(sunday)
    expect(week2.start).toEqual(d(2024, 1, 1))
    expect(week2.end).toEqual(d(2024, 1, 8))
  })

  it('dailyNetTotals across days, oldest first, zero-filled', () => {
    const events = [
      ev(5, d(2024, 1, 1, 9)),
      ev(3, d(2024, 1, 1, 18)),
      ev(-2, d(2024, 1, 3, 9)),
      ev(7, d(2024, 1, 3, 10), { isVoided: true }),
    ]
    const result = dailyNetTotals(events, 3, d(2024, 1, 3, 20))
    expect(result.map((s) => s.net)).toEqual([8, 0, -2])
    expect(result[0].date).toEqual(d(2024, 1, 1))
    expect(result[2].date).toEqual(d(2024, 1, 3))
    expect(dailyNetTotals(events, 0, d(2024, 1, 3))).toEqual([])
  })

  it('events keep childID', () => {
    expect(ev(1, d(2024, 1, 1)).childID).toBe(CHILD)
  })
})
