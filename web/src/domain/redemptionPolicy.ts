// RedemptionPolicy 移植。

import type { Reward } from './types'

export function canAfford(reward: Pick<Reward, 'cost'>, balance: number): boolean {
  return balance >= reward.cost
}

export function pointsNeeded(reward: Pick<Reward, 'cost'>, balance: number): number {
  return Math.max(0, reward.cost - balance)
}

/** 可兑换奖励：isActive 且买得起，按 sortOrder 升序（稳定排序）。 */
export function affordableRewards(rewards: Reward[], balance: number): Reward[] {
  return rewards
    .filter((r) => r.isActive && canAfford(r, balance))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}
