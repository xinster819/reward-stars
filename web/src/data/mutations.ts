// 全部写语义的纯函数实现（快照进 → 新快照出），两个适配器共用，可离线确定性测试。
// 不变量：历史行存快照；撤销=isVoided 软删除；childID 齐备；approve 需余额 ≥ cost。

import type { BehaviorRule, Reward, ScoreEvent, UUID } from '../domain/types'
import { categoryDefaultIcon, newUUID } from '../domain/types'
import { balance, lastUndoableEvent } from '../domain/scoringEngine'
import type { DataSnapshot, RuleInput, RewardInput } from './repository'

function nextSortOrder(items: { sortOrder: number }[]): number {
  return items.reduce((max, i) => Math.max(max, i.sortOrder), -1) + 1
}

export function addRule(snap: DataSnapshot, input: RuleInput, childID: UUID, now: Date): { snap: DataSnapshot; rule: BehaviorRule } {
  const rule: BehaviorRule = {
    id: newUUID(),
    name: input.name,
    details: input.details,
    category: input.category,
    points: input.points,
    iconName: input.iconName ?? categoryDefaultIcon(input.category),
    isActive: true,
    sortOrder: nextSortOrder(snap.rules),
    createdAt: now,
    childID,
  }
  return { snap: { ...snap, rules: [...snap.rules, rule] }, rule }
}

export function updateRule(snap: DataSnapshot, id: UUID, input: RuleInput): DataSnapshot {
  return {
    ...snap,
    rules: snap.rules.map((r) =>
      r.id === id
        ? { ...r, name: input.name, details: input.details, category: input.category, points: input.points, iconName: input.iconName ?? categoryDefaultIcon(input.category) }
        : r,
    ),
  }
}

export function setRuleActive(snap: DataSnapshot, id: UUID, active: boolean): DataSnapshot {
  return { ...snap, rules: snap.rules.map((r) => (r.id === id ? { ...r, isActive: active } : r)) }
}

/** 硬删规则；既有事件保留快照，ruleID 悬空是允许的。 */
export function deleteRule(snap: DataSnapshot, id: UUID): DataSnapshot {
  return { ...snap, rules: snap.rules.filter((r) => r.id !== id) }
}

export function addReward(snap: DataSnapshot, input: RewardInput, childID: UUID, now: Date): { snap: DataSnapshot; reward: Reward } {
  const reward: Reward = {
    id: newUUID(),
    name: input.name,
    cost: input.cost,
    iconName: input.iconName ?? 'gift.fill',
    isActive: true,
    sortOrder: nextSortOrder(snap.rewards),
    createdAt: now,
    childID,
  }
  return { snap: { ...snap, rewards: [...snap.rewards, reward] }, reward }
}

export function updateReward(snap: DataSnapshot, id: UUID, input: RewardInput): DataSnapshot {
  return {
    ...snap,
    rewards: snap.rewards.map((r) =>
      r.id === id ? { ...r, name: input.name, cost: input.cost, iconName: input.iconName ?? 'gift.fill' } : r,
    ),
  }
}

export function setRewardActive(snap: DataSnapshot, id: UUID, active: boolean): DataSnapshot {
  return { ...snap, rewards: snap.rewards.map((r) => (r.id === id ? { ...r, isActive: active } : r)) }
}

export function deleteReward(snap: DataSnapshot, id: UUID): DataSnapshot {
  return { ...snap, rewards: snap.rewards.filter((r) => r.id !== id) }
}

/** 记分：找不到规则返回 ok=false；命中则以规则当前值做快照。 */
export function recordScore(snap: DataSnapshot, ruleID: UUID, note: string | null, at: Date, childID: UUID): { snap: DataSnapshot; ok: boolean; event: ScoreEvent | null } {
  const rule = snap.rules.find((r) => r.id === ruleID)
  if (!rule) return { snap, ok: false, event: null }
  const event: ScoreEvent = {
    id: newUUID(),
    ruleID: rule.id,
    ruleName: rule.name,
    category: rule.category,
    points: rule.points,
    note,
    timestamp: at,
    childID,
    isVoided: false,
  }
  return { snap: { ...snap, events: [...snap.events, event] }, ok: true, event }
}

/** 撤销最近一次：软删除。 */
export function undoLastEvent(snap: DataSnapshot): { snap: DataSnapshot; undone: ScoreEvent | null } {
  const last = lastUndoableEvent(snap.events)
  if (!last) return { snap, undone: null }
  return {
    snap: { ...snap, events: snap.events.map((e) => (e.id === last.id ? { ...e, isVoided: true } : e)) },
    undone: { ...last, isVoided: true },
  }
}

export function requestRedemption(snap: DataSnapshot, rewardID: UUID, at: Date, childID: UUID): { snap: DataSnapshot; ok: boolean } {
  const reward = snap.rewards.find((r) => r.id === rewardID)
  if (!reward) return { snap, ok: false }
  const request = {
    id: newUUID(),
    rewardID: reward.id,
    rewardName: reward.name,
    cost: reward.cost,
    status: 'pending' as const,
    requestedAt: at,
    decidedAt: null,
    childID,
  }
  return { snap: { ...snap, redemptions: [...snap.redemptions, request] }, ok: true }
}

/** 审批：仅 pending 且该孩子余额 ≥ cost 才通过（按 childID 过滤，与云端 RPC 语义一致）。 */
export function approveRedemption(snap: DataSnapshot, id: UUID, at: Date): { snap: DataSnapshot; ok: boolean } {
  const req = snap.redemptions.find((r) => r.id === id)
  if (!req || req.status !== 'pending') return { snap, ok: false }
  const childEvents = snap.events.filter((e) => e.childID === req.childID)
  const childRedemptions = snap.redemptions.filter((r) => r.childID === req.childID)
  if (balance(childEvents, childRedemptions) < req.cost) return { snap, ok: false }
  return {
    snap: {
      ...snap,
      redemptions: snap.redemptions.map((r) => (r.id === id ? { ...r, status: 'approved' as const, decidedAt: at } : r)),
    },
    ok: true,
  }
}

export function rejectRedemption(snap: DataSnapshot, id: UUID, at: Date): DataSnapshot {
  return {
    ...snap,
    redemptions: snap.redemptions.map((r) =>
      r.id === id && r.status === 'pending' ? { ...r, status: 'rejected' as const, decidedAt: at } : r,
    ),
  }
}

/** 改名：trim 后为空则不动。 */
export function renameChild(snap: DataSnapshot, name: string): DataSnapshot {
  const trimmed = name.trim()
  if (!trimmed || !snap.child) return snap
  return { ...snap, child: { ...snap.child, name: trimmed } }
}

export function setAvatar(snap: DataSnapshot, symbol: string): DataSnapshot {
  if (!snap.child) return snap
  return { ...snap, child: { ...snap.child, avatarSymbol: symbol } }
}

/** 清零：删事件与兑换，规则/奖励/孩子保留。 */
export function clearScores(snap: DataSnapshot): DataSnapshot {
  return { ...snap, events: [], redemptions: [] }
}
