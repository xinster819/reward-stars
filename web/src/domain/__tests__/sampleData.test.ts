import { describe, expect, it } from 'vitest'
import { makeSampleBundle } from '../sampleData'
import { balance } from '../scoringEngine'
import { ALL_CATEGORIES } from '../types'
import { d } from './helpers'

describe('SampleData', () => {
  const now = d(2024, 6, 15, 12)
  const bundle = makeSampleBundle(now)

  it('sample bundle invariants', () => {
    expect(bundle.rules.length).toBeGreaterThan(0)
    expect(bundle.rewards.length).toBeGreaterThan(0)
    expect(bundle.events.length).toBeGreaterThan(0)
    // childID 一致
    const cid = bundle.child.id
    for (const r of bundle.rules) expect(r.childID).toBe(cid)
    for (const r of bundle.rewards) expect(r.childID).toBe(cid)
    for (const e of bundle.events) expect(e.childID).toBe(cid)
    // 奖惩混合
    expect(bundle.rules.some((r) => r.points > 0)).toBe(true)
    expect(bundle.rules.some((r) => r.points < 0)).toBe(true)
    // 全部非 voided、时间 ≤ now 且 ≥ now-14 天
    for (const e of bundle.events) {
      expect(e.isVoided).toBe(false)
      expect(e.timestamp.getTime()).toBeLessThanOrEqual(now.getTime())
      expect(e.timestamp.getTime()).toBeGreaterThanOrEqual(now.getTime() - 14 * 86400_000)
    }
    // 初始余额为正
    expect(balance(bundle.events, bundle.redemptions)).toBeGreaterThan(0)
  })

  it('sample events reference existing rules', () => {
    const ruleIDs = new Set(bundle.rules.map((r) => r.id))
    for (const e of bundle.events) {
      expect(e.ruleID === null || ruleIDs.has(e.ruleID)).toBe(true)
    }
  })

  it('sample has enough breadth for demo', () => {
    expect(bundle.rules.length).toBeGreaterThanOrEqual(6)
    expect(bundle.rewards.length).toBeGreaterThanOrEqual(4)
    expect(bundle.events.length).toBeGreaterThanOrEqual(8)
    const cats = new Set(bundle.rules.map((r) => r.category))
    for (const c of ALL_CATEGORIES) expect(cats.has(c)).toBe(true)
  })
})
