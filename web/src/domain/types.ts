// RewardCore 领域类型的 TypeScript 移植（1:1 对位 Swift 值类型）
// 不变量：历史行存快照；撤销=软删除 isVoided；每条业务行带 childID。

export const REWARD_CORE_VERSION = '0.1.0'

export type UUID = string

export const SAMPLE_CHILD_ID: UUID = '00000000-0000-0000-0000-0000000000c1'

export type ScoreCategory = 'learning' | 'life' | 'character' | 'other'

export const ALL_CATEGORIES: ScoreCategory[] = ['learning', 'life', 'character', 'other']

export function categoryDisplayName(c: ScoreCategory): string {
  switch (c) {
    case 'learning': return '学习'
    case 'life': return '生活'
    case 'character': return '品德'
    case 'other': return '其他'
  }
}

export function categoryDefaultIcon(c: ScoreCategory): string {
  switch (c) {
    case 'learning': return 'book.fill'
    case 'life': return 'house.fill'
    case 'character': return 'heart.fill'
    case 'other': return 'star.fill'
  }
}

export type RedemptionStatus = 'pending' | 'approved' | 'rejected'

export function redemptionStatusDisplayName(s: RedemptionStatus): string {
  switch (s) {
    case 'pending': return '待确认'
    case 'approved': return '已兑换'
    case 'rejected': return '已驳回'
  }
}

export interface ChildProfile {
  id: UUID
  name: string
  avatarSymbol: string
  createdAt: Date
}

export interface BehaviorRule {
  id: UUID
  name: string
  details: string | null
  category: ScoreCategory
  points: number
  iconName: string
  isActive: boolean
  sortOrder: number
  createdAt: Date
  childID: UUID
}

export const RULE_DETAILS_MAX_LENGTH = 200

export function isReward(rule: Pick<BehaviorRule, 'points'>): boolean {
  return rule.points >= 0
}

export interface Reward {
  id: UUID
  name: string
  cost: number
  iconName: string
  isActive: boolean
  sortOrder: number
  createdAt: Date
  childID: UUID
}

export interface ScoreEvent {
  id: UUID
  ruleID: UUID | null
  ruleName: string // 快照
  category: ScoreCategory // 快照
  points: number // 快照（带符号）
  note: string | null
  timestamp: Date
  childID: UUID
  isVoided: boolean
}

export function isPositive(event: Pick<ScoreEvent, 'points'>): boolean {
  return event.points >= 0
}

export interface RedemptionRequest {
  id: UUID
  rewardID: UUID | null
  rewardName: string // 快照
  cost: number // 快照
  status: RedemptionStatus
  requestedAt: Date
  decidedAt: Date | null
  childID: UUID
}

export interface DailyScore {
  date: Date // 归一到当天 00:00（本地时区）
  net: number
}

export interface Badge {
  id: string
  title: string
  detail: string
  iconName: string
}

export interface MilestoneProgress {
  current: number
  target: number
  badge: Badge
  remaining: number // max(0, target - current)
  fraction: number // target > 0 ? min(1, current/target) : 1
}

export interface DateInterval {
  start: Date
  end: Date // [start, end)：含头不含尾
}

export interface SampleBundle {
  child: ChildProfile
  rules: BehaviorRule[]
  rewards: Reward[]
  events: ScoreEvent[]
  redemptions: RedemptionRequest[]
}

export function newUUID(): UUID {
  return crypto.randomUUID()
}

// ---- JSON 序列化（对位 Swift Codable；Date ↔ ISO 8601 字符串）----

type Jsonified<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] }

function dateToJSON(d: Date): string {
  return d.toISOString()
}

export function eventToJSON(e: ScoreEvent): Jsonified<ScoreEvent> {
  return { ...e, timestamp: dateToJSON(e.timestamp) }
}

export function eventFromJSON(j: Jsonified<ScoreEvent>): ScoreEvent {
  return { ...j, timestamp: new Date(j.timestamp) }
}

export function rewardToJSON(r: Reward): Jsonified<Reward> {
  return { ...r, createdAt: dateToJSON(r.createdAt) }
}

export function rewardFromJSON(j: Jsonified<Reward>): Reward {
  return { ...j, createdAt: new Date(j.createdAt) }
}

export function ruleToJSON(r: BehaviorRule): Jsonified<BehaviorRule> {
  return { ...r, createdAt: dateToJSON(r.createdAt) }
}

export function ruleFromJSON(j: Jsonified<BehaviorRule>): BehaviorRule {
  return { ...j, createdAt: new Date(j.createdAt) }
}

export function childToJSON(c: ChildProfile): Jsonified<ChildProfile> {
  return { ...c, createdAt: dateToJSON(c.createdAt) }
}

export function childFromJSON(j: Jsonified<ChildProfile>): ChildProfile {
  return { ...j, createdAt: new Date(j.createdAt) }
}

export function redemptionToJSON(r: RedemptionRequest): Jsonified<RedemptionRequest> {
  return { ...r, requestedAt: dateToJSON(r.requestedAt), decidedAt: r.decidedAt ? dateToJSON(r.decidedAt) : null }
}

export function redemptionFromJSON(j: Jsonified<RedemptionRequest>): RedemptionRequest {
  return { ...j, requestedAt: new Date(j.requestedAt), decidedAt: j.decidedAt ? new Date(j.decidedAt) : null }
}
