import { describe, expect, it } from 'vitest'
import { earnedBadges, nextMilestone } from '../badgeEngine'
import { d, ev } from './helpers'

describe('BadgeEngine', () => {
  it('no badges when nothing earned', () => {
    expect(earnedBadges([], d(2024, 1, 10))).toEqual([])
  })

  it('milestone and streak badges earned', () => {
    // 3 天 × 40 分 = 120 累计，连击 3
    const events = [
      ev(40, d(2024, 1, 8, 9)),
      ev(40, d(2024, 1, 9, 9)),
      ev(40, d(2024, 1, 10, 9)),
    ]
    const ids = earnedBadges(events, d(2024, 1, 10, 20)).map((b) => b.id)
    expect(ids).toEqual(['milestone_50', 'milestone_100', 'streak_3'])
  })

  it('seven day streak earns both streak badges', () => {
    const events = Array.from({ length: 7 }, (_, i) => ev(5, d(2024, 1, 4 + i, 9)))
    const ids = earnedBadges(events, d(2024, 1, 10, 20)).map((b) => b.id)
    expect(ids).toContain('streak_3')
    expect(ids).toContain('streak_7')
  })

  it('nextMilestone remaining and fraction', () => {
    const events = [ev(120, d(2024, 1, 10, 9))]
    const next = nextMilestone(events)
    expect(next?.target).toBe(200)
    expect(next?.remaining).toBe(80)
    expect(next?.fraction).toBeCloseTo(0.6)
  })

  it('nextMilestone null when all reached', () => {
    const events = [ev(600, d(2024, 1, 10, 9))]
    expect(nextMilestone(events)).toBeNull()
  })

  it('nextMilestone fraction clamped to 1', () => {
    // current 可能 ≥ target？fraction = min(1, ...)
    const next = nextMilestone([ev(49, d(2024, 1, 10))])
    expect(next?.fraction).toBeLessThanOrEqual(1)
    expect(next?.fraction).toBeCloseTo(49 / 50)
    expect(nextMilestone([])?.fraction).toBe(0)
  })
})
