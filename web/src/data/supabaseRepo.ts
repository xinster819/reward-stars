// 云适配器：Supabase(Postgres+RLS+Realtime)。写路径 = 乐观本地应用 + 推送云端；
// 远端变更（其他设备）经 realtime 触发全量重取（数据量小，简单正确优先）。
// ⚠️ 云端真实行为在用户接线（SETUP.md §10）前未经实测验证（D25 边界）。

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { BehaviorRule, ChildProfile, RedemptionRequest, Reward, ScoreCategory, ScoreEvent, UUID } from '../domain/types'
import { newUUID } from '../domain/types'
import { encodePinBlob, verifyPinBlob } from '../domain/pinHasher'
import { makeSampleBundle } from '../domain/sampleData'
import type { BackupBundle, DataSnapshot, RewardRepo, RewardInput, RuleInput } from './repository'
import { EMPTY_SNAPSHOT } from './repository'
import * as mut from './mutations'

type Localizer = (s: string) => string

// ---- 行映射：snake_case 行 ↔ 领域类型 ----
const rowToChild = (r: any): ChildProfile => ({ id: r.id, name: r.name, avatarSymbol: r.avatar_symbol, createdAt: new Date(r.created_at) })
const rowToRule = (r: any): BehaviorRule => ({ id: r.id, name: r.name, details: r.details, category: r.category as ScoreCategory, points: r.points, iconName: r.icon_name, isActive: r.is_active, sortOrder: r.sort_order, createdAt: new Date(r.created_at), childID: r.child_id })
const rowToEvent = (r: any): ScoreEvent => ({ id: r.id, ruleID: r.rule_id, ruleName: r.rule_name, category: r.category as ScoreCategory, points: r.points, note: r.note, timestamp: new Date(r.ts), childID: r.child_id, isVoided: r.is_voided })
const rowToReward = (r: any): Reward => ({ id: r.id, name: r.name, cost: r.cost, iconName: r.icon_name, isActive: r.is_active, sortOrder: r.sort_order, createdAt: new Date(r.created_at), childID: r.child_id })
const rowToRedemption = (r: any): RedemptionRequest => ({ id: r.id, rewardID: r.reward_id, rewardName: r.reward_name, cost: r.cost, status: r.status, requestedAt: new Date(r.requested_at), decidedAt: r.decided_at ? new Date(r.decided_at) : null, childID: r.child_id })

export class SupabaseRepo implements RewardRepo {
  private snap: DataSnapshot = EMPTY_SNAPSHOT
  private listeners = new Set<() => void>()
  private pinBlob: string | null = null
  private weeklyReportEnabled = true
  private readyPromise: Promise<void>
  private client: SupabaseClient
  private familyID: UUID
  /** 当前孩子 id：以云端数据为准（refetch 后更新）；seed 时按家庭随机生成，绝不用全局常量。 */
  private childID: UUID | null = null
  private localize: Localizer
  private onSyncError: (message: string) => void
  /** 单调代次：乐观提交与并发 refetch 之间的先后仲裁（旧 refetch 结果作废）。 */
  private generation = 0
  private channel: RealtimeChannel | null = null
  private disposed = false

  constructor(
    client: SupabaseClient,
    familyID: UUID,
    localize: Localizer = (s) => s,
    onSyncError: (message: string) => void = (m) => console.error('[sync]', m),
  ) {
    this.client = client
    this.familyID = familyID
    this.localize = localize
    this.onSyncError = onSyncError
    this.readyPromise = this.refetch(true)
    this.subscribeRealtime()
  }

  /** 初次加载失败会 reject —— 调用方必须给出重试 UI，绝不能把离线误当"新家庭"走引导。 */
  async ready(): Promise<void> {
    await this.readyPromise
  }

  async refresh(): Promise<void> {
    await this.refetch().catch(() => {})
  }

  dispose(): void {
    this.disposed = true
    this.generation++
    if (this.channel) {
      void this.client.removeChannel(this.channel)
      this.channel = null
    }
    this.listeners.clear()
  }

  getSnapshot(): DataSnapshot {
    return this.snap
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach((l) => l())
  }

  private async refetch(initial = false): Promise<void> {
    if (this.disposed) return
    const gen = ++this.generation
    const [family, children, rules, events, rewards, redemptions] = await Promise.all([
      this.client.from('families').select('pin_blob, weekly_report_enabled').eq('id', this.familyID).maybeSingle(),
      this.client.from('children').select('*').eq('family_id', this.familyID).order('created_at'),
      this.client.from('rules').select('*').eq('family_id', this.familyID).order('sort_order'),
      this.client.from('events').select('*').eq('family_id', this.familyID).order('ts'),
      this.client.from('rewards').select('*').eq('family_id', this.familyID).order('sort_order'),
      this.client.from('redemptions').select('*').eq('family_id', this.familyID).order('requested_at'),
    ])
    const firstError = [family, children, rules, events, rewards, redemptions].find((r) => r.error)?.error
    if (firstError) {
      this.onSyncError(firstError.message)
      if (initial) throw new Error(firstError.message)
      return
    }
    if (gen !== this.generation || this.disposed) return // 期间有乐观提交/新 refetch → 本结果作废
    this.pinBlob = family.data?.pin_blob ?? null
    this.weeklyReportEnabled = family.data?.weekly_report_enabled ?? true
    const child = (children.data ?? []).map(rowToChild)[0] ?? null
    if (child) this.childID = child.id
    this.snap = {
      child,
      rules: (rules.data ?? []).map(rowToRule),
      events: (events.data ?? []).map(rowToEvent),
      rewards: (rewards.data ?? []).map(rowToReward),
      redemptions: (redemptions.data ?? []).map(rowToRedemption),
    }
    this.notify()
  }

  private safeRefetch = () => {
    void this.refetch().catch(() => {})
  }

  private subscribeRealtime(): void {
    const opts = (table: string) =>
      ({ event: '*', schema: 'public', table, filter: `family_id=eq.${this.familyID}` }) as const
    this.channel = this.client
      .channel(`family-${this.familyID}`)
      // families 承载 PIN 同步 + touched_at 心跳（destructive 操作后 bump，绕开 DELETE 事件过滤盲区）
      .on('postgres_changes', { event: '*', schema: 'public', table: 'families', filter: `id=eq.${this.familyID}` }, this.safeRefetch)
      .on('postgres_changes', opts('children'), this.safeRefetch)
      .on('postgres_changes', opts('rules'), this.safeRefetch)
      .on('postgres_changes', opts('events'), this.safeRefetch)
      .on('postgres_changes', opts('rewards'), this.safeRefetch)
      .on('postgres_changes', opts('redemptions'), this.safeRefetch)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[realtime]', status)
          this.safeRefetch() // 至少把当下状态补齐；页面 focus 时还会再补（见 main.tsx）
        }
      })
  }

  /** 破坏性操作后 bump families.touched_at：DELETE 的 realtime 事件不一定按 filter 送达对端。 */
  private touchFamily(): PromiseLike<{ error: { message: string } | null }> {
    return this.client.from('families').update({ touched_at: new Date().toISOString() }).eq('id', this.familyID)
  }

  /** 乐观提交：先本地应用刷 UI，再推云端；推送失败则回滚重取并报错。 */
  private async commit(next: DataSnapshot, push: () => PromiseLike<{ error: { message: string } | null }>): Promise<void> {
    this.generation++ // 使在途 refetch 作废，防止旧快照覆盖乐观状态
    this.snap = next
    this.notify()
    const { error } = await push()
    if (error) {
      this.onSyncError(error.message)
      await this.refetch().catch(() => {})
    }
  }

  private requireChildID(): UUID {
    if (!this.childID) throw new Error('no child seeded yet')
    return this.childID
  }

  private ruleRow(r: BehaviorRule) {
    return { id: r.id, family_id: this.familyID, child_id: r.childID, name: r.name, details: r.details, category: r.category, points: r.points, icon_name: r.iconName, is_active: r.isActive, sort_order: r.sortOrder, created_at: r.createdAt.toISOString() }
  }
  private rewardRow(r: Reward) {
    return { id: r.id, family_id: this.familyID, child_id: r.childID, name: r.name, cost: r.cost, icon_name: r.iconName, is_active: r.isActive, sort_order: r.sortOrder, created_at: r.createdAt.toISOString() }
  }
  private eventRow(e: ScoreEvent) {
    return { id: e.id, family_id: this.familyID, child_id: e.childID, rule_id: e.ruleID, rule_name: e.ruleName, category: e.category, points: e.points, note: e.note, ts: e.timestamp.toISOString(), is_voided: e.isVoided }
  }
  private redemptionRow(r: RedemptionRequest) {
    return { id: r.id, family_id: this.familyID, child_id: r.childID, reward_id: r.rewardID, reward_name: r.rewardName, cost: r.cost, status: r.status, requested_at: r.requestedAt.toISOString(), decided_at: r.decidedAt?.toISOString() ?? null }
  }

  // ---- 规则 ----
  async addRule(input: RuleInput): Promise<void> {
    const { snap, rule } = mut.addRule(this.snap, input, this.requireChildID(), new Date())
    await this.commit(snap, () => this.client.from('rules').insert(this.ruleRow(rule)))
  }
  async updateRule(id: UUID, input: RuleInput): Promise<void> {
    const snap = mut.updateRule(this.snap, id, input)
    const rule = snap.rules.find((r) => r.id === id)
    if (!rule) return
    await this.commit(snap, () => this.client.from('rules').update(this.ruleRow(rule)).eq('id', id))
  }
  async setRuleActive(id: UUID, active: boolean): Promise<void> {
    await this.commit(mut.setRuleActive(this.snap, id, active), () =>
      this.client.from('rules').update({ is_active: active }).eq('id', id))
  }
  async deleteRule(id: UUID): Promise<void> {
    await this.commit(mut.deleteRule(this.snap, id), async () => {
      const r = await this.client.from('rules').delete().eq('id', id)
      if (r.error) return r
      return this.touchFamily()
    })
  }

  // ---- 奖励 ----
  async addReward(input: RewardInput): Promise<void> {
    const { snap, reward } = mut.addReward(this.snap, input, this.requireChildID(), new Date())
    await this.commit(snap, () => this.client.from('rewards').insert(this.rewardRow(reward)))
  }
  async updateReward(id: UUID, input: RewardInput): Promise<void> {
    const snap = mut.updateReward(this.snap, id, input)
    const reward = snap.rewards.find((r) => r.id === id)
    if (!reward) return
    await this.commit(snap, () => this.client.from('rewards').update(this.rewardRow(reward)).eq('id', id))
  }
  async setRewardActive(id: UUID, active: boolean): Promise<void> {
    await this.commit(mut.setRewardActive(this.snap, id, active), () =>
      this.client.from('rewards').update({ is_active: active }).eq('id', id))
  }
  async deleteReward(id: UUID): Promise<void> {
    await this.commit(mut.deleteReward(this.snap, id), async () => {
      const r = await this.client.from('rewards').delete().eq('id', id)
      if (r.error) return r
      return this.touchFamily()
    })
  }

  // ---- 记分 / 撤销 ----
  async recordScore(ruleID: UUID, note: string | null, at: Date = new Date()): Promise<boolean> {
    const r = mut.recordScore(this.snap, ruleID, note, at, this.requireChildID())
    if (!r.ok || !r.event) return false
    const event = r.event
    await this.commit(r.snap, () => this.client.from('events').insert(this.eventRow(event)))
    return true
  }
  async undoLastEvent(): Promise<ScoreEvent | null> {
    const r = mut.undoLastEvent(this.snap)
    if (!r.undone) return null
    const undone = r.undone
    await this.commit(r.snap, () => this.client.from('events').update({ is_voided: true }).eq('id', undone.id))
    return r.undone
  }

  // ---- 兑换 ----
  async requestRedemption(rewardID: UUID, at: Date = new Date()): Promise<boolean> {
    const r = mut.requestRedemption(this.snap, rewardID, at, this.requireChildID())
    if (!r.ok) return false
    const row = this.redemptionRow(r.snap.redemptions[r.snap.redemptions.length - 1])
    await this.commit(r.snap, () => this.client.from('redemptions').insert(row))
    return true
  }
  /** 审批走服务端 RPC：家庭级锁 + 事务内复验余额（多端并发以服务端为准）。 */
  async approveRedemption(id: UUID): Promise<boolean> {
    const { data, error } = await this.client.rpc('approve_redemption', { rid: id })
    if (error) {
      this.onSyncError(error.message)
      return false
    }
    await this.refetch().catch(() => {})
    return data === true
  }
  async rejectRedemption(id: UUID, at: Date = new Date()): Promise<void> {
    await this.commit(mut.rejectRedemption(this.snap, id, at), () =>
      this.client.from('redemptions').update({ status: 'rejected', decided_at: at.toISOString() }).eq('id', id).eq('status', 'pending'))
    // 若对端已抢先 approve，上面 0 行命中且无 realtime 事件指向本端 → 主动校准
    await this.refetch().catch(() => {})
  }

  // ---- 孩子档案 ----
  async renameChild(name: string): Promise<void> {
    const snap = mut.renameChild(this.snap, name)
    if (snap === this.snap || !snap.child) return
    const { id, name: newName } = snap.child
    await this.commit(snap, () => this.client.from('children').update({ name: newName }).eq('id', id))
  }
  async setAvatar(symbol: string): Promise<void> {
    const snap = mut.setAvatar(this.snap, symbol)
    if (!snap.child) return
    const childId = snap.child.id
    await this.commit(snap, () => this.client.from('children').update({ avatar_symbol: symbol }).eq('id', childId))
  }

  // ---- 维护 ----
  async clearScores(): Promise<void> {
    const cid = this.requireChildID()
    await this.commit(mut.clearScores(this.snap), async () => {
      const a = await this.client.from('events').delete().eq('family_id', this.familyID).eq('child_id', cid)
      if (a.error) return a
      const b = await this.client.from('redemptions').delete().eq('family_id', this.familyID).eq('child_id', cid)
      if (b.error) return b
      return this.touchFamily()
    })
  }

  async seedIfEmpty(childName: string = '', now: Date = new Date()): Promise<void> {
    await this.readyPromise
    if (this.snap.child) return
    const cid = newUUID() // 每个家庭独立随机 childID（children.id 是全局主键，常量会撞第二个家庭）
    const bundle = makeSampleBundle(now, cid)
    const child: ChildProfile = { ...bundle.child, name: childName.trim() || this.localize('宝贝'), avatarSymbol: 'DefaultAvatar', createdAt: now }
    const rules = bundle.rules.map((r) => ({ ...r, name: this.localize(r.name) }))
    const rewards = bundle.rewards.map((r) => ({ ...r, name: this.localize(r.name) }))
    this.childID = cid
    const next: DataSnapshot = { child, rules, rewards, events: [], redemptions: [] }
    await this.commit(next, async () => {
      const fam = await this.client.from('families').upsert({ id: this.familyID }, { onConflict: 'id' })
      if (fam.error) return fam
      const c = await this.client.from('children').insert({ id: child.id, family_id: this.familyID, name: child.name, avatar_symbol: child.avatarSymbol, created_at: child.createdAt.toISOString() })
      if (c.error) return c
      const r1 = await this.client.from('rules').insert(rules.map((r) => this.ruleRow(r)))
      if (r1.error) return r1
      return this.client.from('rewards').insert(rewards.map((r) => this.rewardRow(r)))
    })
  }

  async resetAndSeed(childName: string = '', now: Date = new Date()): Promise<void> {
    // 用事务化 RPC 清库（空 bundle = 全删），再 seed
    const { error } = await this.client.rpc('import_bundle', { payload: { children: [], rules: [], events: [], rewards: [], redemptions: [] } })
    if (error) {
      this.onSyncError(error.message)
      return
    }
    this.generation++
    this.snap = EMPTY_SNAPSHOT
    this.childID = null
    this.notify()
    await this.seedIfEmpty(childName, now)
  }

  // ---- 备份 ----
  exportBundle(now: Date = new Date()): BackupBundle {
    const s = this.snap
    return {
      schemaVersion: '1.0.0',
      exportedAt: now.toISOString(),
      children: s.child ? [s.child] : [],
      rules: s.rules,
      events: s.events,
      rewards: s.rewards,
      redemptions: s.redemptions,
    }
  }

  /** 整体替换语义；服务端单事务（中途失败自动回滚，不会删完不进）。 */
  async importBundle(bundle: BackupBundle, _replace: boolean): Promise<void> {
    const payload = {
      children: bundle.children.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
      rules: bundle.rules.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      events: bundle.events.map((e) => ({ ...e, timestamp: e.timestamp.toISOString() })),
      rewards: bundle.rewards.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      redemptions: bundle.redemptions.map((r) => ({ ...r, requestedAt: r.requestedAt.toISOString(), decidedAt: r.decidedAt?.toISOString() ?? null })),
    }
    const { error } = await this.client.rpc('import_bundle', { payload })
    if (error) {
      this.onSyncError(error.message)
      return
    }
    await this.refetch().catch(() => {})
  }

  // ---- PIN（随家庭同步）----
  isPINSet(): boolean {
    return this.pinBlob !== null
  }
  async setPIN(pin: string): Promise<void> {
    const blob = await encodePinBlob(pin)
    const { error } = await this.client.from('families').upsert({ id: this.familyID, pin_blob: blob }, { onConflict: 'id' })
    if (error) {
      this.onSyncError(error.message)
      throw new Error(error.message)
    }
    this.pinBlob = blob
    this.snap = { ...this.snap } // useSyncExternalStore 按快照引用判变
    this.notify()
  }
  async verifyPIN(pin: string): Promise<boolean> {
    if (!this.pinBlob) return false
    return verifyPinBlob(pin, this.pinBlob)
  }

  // ---- 每周周报邮件开关（随家庭同步；服务端 Edge Function 据此决定是否发信）----
  getWeeklyReportEnabled(): boolean {
    return this.weeklyReportEnabled
  }
  async setWeeklyReportEnabled(enabled: boolean): Promise<void> {
    const { error } = await this.client.from('families').upsert({ id: this.familyID, weekly_report_enabled: enabled }, { onConflict: 'id' })
    if (error) {
      this.onSyncError(error.message)
      throw new Error(error.message)
    }
    this.weeklyReportEnabled = enabled
    this.snap = { ...this.snap } // useSyncExternalStore 按快照引用判变
    this.notify()
  }
}
