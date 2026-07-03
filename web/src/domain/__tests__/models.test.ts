import { describe, expect, it } from 'vitest'
import {
  ALL_CATEGORIES, REWARD_CORE_VERSION,
  categoryDefaultIcon, categoryDisplayName,
  eventFromJSON, eventToJSON, isReward,
  redemptionFromJSON, redemptionToJSON,
  rewardFromJSON, rewardToJSON,
} from '../types'
import type { RedemptionRequest, Reward } from '../types'
import { CHILD, d, ev } from './helpers'
import { newUUID } from '../types'

describe('Models', () => {
  it('score category display names', () => {
    expect(categoryDisplayName('learning')).toBe('学习')
    expect(categoryDisplayName('life')).toBe('生活')
    expect(categoryDisplayName('character')).toBe('品德')
    expect(categoryDisplayName('other')).toBe('其他')
  })

  it('score category has default icon', () => {
    for (const c of ALL_CATEGORIES) expect(categoryDefaultIcon(c).length).toBeGreaterThan(0)
  })

  it('behavior rule isReward by sign', () => {
    expect(isReward({ points: 5 })).toBe(true)
    expect(isReward({ points: 0 })).toBe(true)
    expect(isReward({ points: -3 })).toBe(false)
  })

  it('score event JSON roundtrip preserves equality', () => {
    const e = ev(7, d(2024, 3, 5, 14, 30), { note: '备注', ruleID: newUUID() })
    const back = eventFromJSON(JSON.parse(JSON.stringify(eventToJSON(e))))
    expect(back).toEqual(e)
  })

  it('reward JSON roundtrip preserves equality', () => {
    const r: Reward = {
      id: newUUID(), name: '看电视', cost: 20, iconName: 'tv.fill',
      isActive: true, sortOrder: 1, createdAt: d(2024, 2, 1), childID: CHILD,
    }
    const back = rewardFromJSON(JSON.parse(JSON.stringify(rewardToJSON(r))))
    expect(back).toEqual(r)
  })

  it('redemption request defaults & roundtrip', () => {
    const r: RedemptionRequest = {
      id: newUUID(), rewardID: null, rewardName: '冰淇淋', cost: 15,
      status: 'pending', requestedAt: d(2024, 2, 2, 10), decidedAt: null, childID: CHILD,
    }
    expect(r.status).toBe('pending')
    expect(r.decidedAt).toBeNull()
    const back = redemptionFromJSON(JSON.parse(JSON.stringify(redemptionToJSON(r))))
    expect(back).toEqual(r)
  })

  it('version exposed', () => {
    expect(REWARD_CORE_VERSION).toBe('0.1.0')
  })
})
