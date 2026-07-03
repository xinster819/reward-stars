// BadgeEngine 移植：里程碑（累计获得）+ 连击徽章；标题为领域中文，展示层再本地化。

import type { Badge, MilestoneProgress, ScoreEvent } from './types'
import { cumulativeEarned } from './scoringEngine'
import { currentStreak } from './streakCalculator'

export const MILESTONE_THRESHOLDS = [50, 100, 200, 500] as const
export const STREAK_THRESHOLDS = [3, 7] as const

export function milestoneBadge(threshold: number): Badge {
  switch (threshold) {
    case 50: return { id: 'milestone_50', title: '起步星', detail: '累计获得 50 分', iconName: 'leaf.fill' }
    case 100: return { id: 'milestone_100', title: '百分达人', detail: '累计获得 100 分', iconName: 'star.fill' }
    case 200: return { id: 'milestone_200', title: '超级明星', detail: '累计获得 200 分', iconName: 'rosette' }
    case 500: return { id: 'milestone_500', title: '积分大师', detail: '累计获得 500 分', iconName: 'crown.fill' }
    default: throw new Error(`unknown milestone threshold: ${threshold}`)
  }
}

export function streakBadge(threshold: number): Badge {
  switch (threshold) {
    case 3: return { id: 'streak_3', title: '三连击', detail: '连续 3 天表现棒', iconName: 'flame.fill' }
    case 7: return { id: 'streak_7', title: '七日坚持', detail: '连续 7 天表现棒', iconName: 'flame.circle.fill' }
    default: throw new Error(`unknown streak threshold: ${threshold}`)
  }
}

/** 已获徽章：里程碑（升序）在前，连击（升序）在后。 */
export function earnedBadges(events: ScoreEvent[], asOf: Date): Badge[] {
  const earned = cumulativeEarned(events)
  const streak = currentStreak(events, asOf)
  const badges: Badge[] = []
  for (const t of MILESTONE_THRESHOLDS) if (earned >= t) badges.push(milestoneBadge(t))
  for (const t of STREAK_THRESHOLDS) if (streak >= t) badges.push(streakBadge(t))
  return badges
}

/** 下一个里程碑进度；全部达成则 null。 */
export function nextMilestone(events: ScoreEvent[]): MilestoneProgress | null {
  const earned = cumulativeEarned(events)
  for (const t of MILESTONE_THRESHOLDS) {
    if (earned < t) {
      return {
        current: earned,
        target: t,
        badge: milestoneBadge(t),
        remaining: Math.max(0, t - earned),
        fraction: t > 0 ? Math.min(1, earned / t) : 1,
      }
    }
  }
  return null
}
