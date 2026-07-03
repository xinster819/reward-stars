import type { RedemptionRequest, ScoreEvent, UUID } from '../types'
import { newUUID } from '../types'

export const CHILD: UUID = '00000000-0000-0000-0000-0000000000c1'

/** 本地时间构造日期（引擎按本地时区算天界，测试同源即确定性）。 */
export function d(y: number, m: number, day: number, h = 0, min = 0): Date {
  return new Date(y, m - 1, day, h, min)
}

export function ev(points: number, timestamp: Date, opts: Partial<ScoreEvent> = {}): ScoreEvent {
  return {
    id: newUUID(),
    ruleID: null,
    ruleName: 'rule',
    category: 'learning',
    points,
    note: null,
    timestamp,
    childID: CHILD,
    isVoided: false,
    ...opts,
  }
}

export function redemption(cost: number, status: RedemptionRequest['status'], requestedAt: Date): RedemptionRequest {
  return {
    id: newUUID(),
    rewardID: null,
    rewardName: 'reward',
    cost,
    status,
    requestedAt,
    decidedAt: status === 'pending' ? null : requestedAt,
    childID: CHILD,
  }
}
