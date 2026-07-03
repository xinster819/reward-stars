import { describe, expect, it } from 'vitest'
import { currentStreak } from '../streakCalculator'
import { d, ev } from './helpers'

describe('StreakCalculator', () => {
  it('consecutive positive days count streak', () => {
    const events = [
      ev(5, d(2024, 1, 8, 9)),
      ev(3, d(2024, 1, 9, 9)),
      ev(4, d(2024, 1, 10, 9)),
    ]
    expect(currentStreak(events, d(2024, 1, 10, 20))).toBe(3)
  })

  it('streak broken when today not positive', () => {
    const events = [
      ev(5, d(2024, 1, 9, 9)),
      ev(-1, d(2024, 1, 10, 9)), // 今天净分为负
    ]
    expect(currentStreak(events, d(2024, 1, 10, 20))).toBe(0)
  })

  it('streak stops at gap', () => {
    const events = [
      ev(5, d(2024, 1, 6, 9)),
      // 1/7 缺天
      ev(3, d(2024, 1, 8, 9)),
      ev(4, d(2024, 1, 9, 9)),
    ]
    expect(currentStreak(events, d(2024, 1, 9, 20))).toBe(2)
  })

  it('net zero day does not count', () => {
    const events = [
      ev(5, d(2024, 1, 9, 9)),
      ev(4, d(2024, 1, 10, 9)),
      ev(-4, d(2024, 1, 10, 10)), // 今天净 0 → 断
    ]
    expect(currentStreak(events, d(2024, 1, 10, 20))).toBe(0)
  })

  it('voided events excluded from streak', () => {
    const events = [
      ev(5, d(2024, 1, 9, 9)),
      ev(4, d(2024, 1, 10, 9), { isVoided: true }), // 今天只有 voided → 净 0
    ]
    expect(currentStreak(events, d(2024, 1, 10, 20))).toBe(0)
  })

  it('no events means zero streak', () => {
    expect(currentStreak([], d(2024, 1, 10))).toBe(0)
  })
})
