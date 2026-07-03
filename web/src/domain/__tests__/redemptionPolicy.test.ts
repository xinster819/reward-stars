import { describe, expect, it } from 'vitest'
import { affordableRewards, canAfford, pointsNeeded } from '../redemptionPolicy'
import type { Reward } from '../types'
import { CHILD, d } from './helpers'
import { newUUID } from '../types'

function reward(cost: number, opts: Partial<Reward> = {}): Reward {
  return {
    id: newUUID(), name: 'r', cost, iconName: 'gift.fill',
    isActive: true, sortOrder: 0, createdAt: d(2024, 1, 1), childID: CHILD,
    ...opts,
  }
}

describe('RedemptionPolicy', () => {
  it('can afford when balance meets cost', () => {
    expect(canAfford(reward(20), 20)).toBe(true)
    expect(canAfford(reward(20), 25)).toBe(true)
  })

  it('cannot afford when balance below cost', () => {
    expect(canAfford(reward(20), 19)).toBe(false)
  })

  it('pointsNeeded clamped at zero', () => {
    expect(pointsNeeded(reward(20), 5)).toBe(15)
    expect(pointsNeeded(reward(20), 20)).toBe(0)
    expect(pointsNeeded(reward(20), 99)).toBe(0)
  })

  it('affordableRewards filters active & affordable, sorted by order', () => {
    const a = reward(10, { sortOrder: 2 })
    const b = reward(5, { sortOrder: 1 })
    const inactive = reward(1, { sortOrder: 0, isActive: false })
    const tooExpensive = reward(99, { sortOrder: 3 })
    const result = affordableRewards([a, inactive, tooExpensive, b], 10)
    expect(result.map((r) => r.id)).toEqual([b.id, a.id])
  })
})
