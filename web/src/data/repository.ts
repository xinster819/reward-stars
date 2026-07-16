// 仓库接口：1:1 对位 iOS RewardRepository 的读写语义（D25）。
// 两个实现：localRepo（localStorage，演示/离线）与 supabaseRepo（云端多端共享）。

import type {
  BehaviorRule, ChildProfile, RedemptionRequest, Reward, ScoreCategory, ScoreEvent, UUID,
} from '../domain/types'

export interface DataSnapshot {
  child: ChildProfile | null
  rules: BehaviorRule[]
  rewards: Reward[]
  events: ScoreEvent[]
  redemptions: RedemptionRequest[]
}

export const EMPTY_SNAPSHOT: DataSnapshot = { child: null, rules: [], rewards: [], events: [], redemptions: [] }

export interface BackupBundle {
  schemaVersion: string
  exportedAt: string
  children: ChildProfile[]
  rules: BehaviorRule[]
  events: ScoreEvent[]
  rewards: Reward[]
  redemptions: RedemptionRequest[]
}

export interface RuleInput {
  name: string
  details: string | null
  category: ScoreCategory
  points: number
  iconName: string | null
}

export interface RewardInput {
  name: string
  cost: number
  iconName: string | null
}

export interface RewardRepo {
  /** 初始加载完成（本地=同步读盘，云=首次 fetch；云端首拉失败会 reject，调用方给重试 UI）。 */
  ready(): Promise<void>
  /** 主动校准（页面 focus / 可见性恢复时调用）：本地=重读存储（多标签页），云=refetch。 */
  refresh(): Promise<void>
  getSnapshot(): DataSnapshot
  subscribe(listener: () => void): () => void

  // 规则
  addRule(input: RuleInput): Promise<void>
  updateRule(id: UUID, input: RuleInput): Promise<void>
  setRuleActive(id: UUID, active: boolean): Promise<void>
  deleteRule(id: UUID): Promise<void>

  // 奖励
  addReward(input: RewardInput): Promise<void>
  updateReward(id: UUID, input: RewardInput): Promise<void>
  setRewardActive(id: UUID, active: boolean): Promise<void>
  deleteReward(id: UUID): Promise<void>

  // 记分 / 撤销
  recordScore(ruleID: UUID, note: string | null, at?: Date): Promise<boolean>
  undoLastEvent(): Promise<ScoreEvent | null>

  // 兑换
  requestRedemption(rewardID: UUID, at?: Date): Promise<boolean>
  approveRedemption(id: UUID, at?: Date): Promise<boolean>
  rejectRedemption(id: UUID, at?: Date): Promise<void>

  // 孩子档案
  renameChild(name: string): Promise<void>
  setAvatar(symbol: string): Promise<void>

  // 维护
  clearScores(): Promise<void>
  seedIfEmpty(childName?: string, now?: Date): Promise<void>
  resetAndSeed(childName?: string, now?: Date): Promise<void>

  // 备份
  exportBundle(now?: Date): BackupBundle
  importBundle(bundle: BackupBundle, replace: boolean): Promise<void>

  // 家长 PIN（本地=localStorage blob；云=family 行随家庭同步）
  isPINSet(): boolean
  setPIN(pin: string): Promise<void>
  verifyPIN(pin: string): Promise<boolean>

  // 每周积分周报邮件开关（本地=localStorage 占位，本地模式不发邮件；云=family 行随家庭同步）
  getWeeklyReportEnabled(): boolean
  setWeeklyReportEnabled(enabled: boolean): Promise<void>
}
