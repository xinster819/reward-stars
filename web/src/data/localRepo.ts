// 本地适配器：localStorage 持久化（无账号全功能，演示/离线模式）。

import type { ScoreEvent, UUID } from '../domain/types'
import {
  SAMPLE_CHILD_ID,
  childFromJSON, childToJSON,
  eventFromJSON, eventToJSON,
  redemptionFromJSON, redemptionToJSON,
  rewardFromJSON, rewardToJSON,
  ruleFromJSON, ruleToJSON,
} from '../domain/types'
import { encodePinBlob, verifyPinBlob } from '../domain/pinHasher'
import { makeSampleBundle } from '../domain/sampleData'
import type { BackupBundle, DataSnapshot, RewardRepo, RewardInput, RuleInput } from './repository'
import { EMPTY_SNAPSHOT } from './repository'
import * as mut from './mutations'

const DATA_KEY = 'reward-stars-data-v1'
const PIN_KEY = 'reward-stars-pin-v1'

type Localizer = (s: string) => string

export class LocalRepo implements RewardRepo {
  private snap: DataSnapshot = EMPTY_SNAPSHOT
  private listeners = new Set<() => void>()
  private storage: Storage
  private childID: UUID
  private localize: Localizer

  constructor(storage: Storage, childID: UUID = SAMPLE_CHILD_ID, localize: Localizer = (s) => s) {
    this.storage = storage
    this.childID = childID
    this.localize = localize
    this.load()
  }

  async ready(): Promise<void> {}

  /** 重读存储：另一标签页可能写过。 */
  async refresh(): Promise<void> {
    this.load()
    this.listeners.forEach((l) => l())
  }

  getSnapshot(): DataSnapshot {
    return this.snap
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private commit(snap: DataSnapshot): void {
    this.snap = snap
    this.persist()
    this.listeners.forEach((l) => l())
  }

  private persist(): void {
    const s = this.snap
    try {
      this.storage.setItem(DATA_KEY, JSON.stringify({
        child: s.child ? childToJSON(s.child) : null,
        rules: s.rules.map(ruleToJSON),
        rewards: s.rewards.map(rewardToJSON),
        events: s.events.map(eventToJSON),
        redemptions: s.redemptions.map(redemptionToJSON),
      }))
    } catch (e) {
      // 配额满 / Safari 隐私模式：内存态照常工作，但落盘失败要留痕（刷新会丢这次改动）
      console.error('[localRepo] persist failed:', e)
    }
  }

  private load(): void {
    const raw = this.storage.getItem(DATA_KEY)
    if (!raw) return
    try {
      const j = JSON.parse(raw)
      this.snap = {
        child: j.child ? childFromJSON(j.child) : null,
        rules: (j.rules ?? []).map(ruleFromJSON),
        rewards: (j.rewards ?? []).map(rewardFromJSON),
        events: (j.events ?? []).map(eventFromJSON),
        redemptions: (j.redemptions ?? []).map(redemptionFromJSON),
      }
    } catch {
      // 损坏数据先整体挪到备份 key（后续 commit 会覆盖主 key，不挪就真丢了），再以空快照起步
      try {
        this.storage.setItem(`${DATA_KEY}-corrupt-${Date.now()}`, raw)
      } catch { /* 备份失败也不阻塞启动 */ }
      this.snap = EMPTY_SNAPSHOT
    }
  }

  // ---- 规则 ----
  async addRule(input: RuleInput): Promise<void> {
    this.commit(mut.addRule(this.snap, input, this.childID, new Date()).snap)
  }
  async updateRule(id: UUID, input: RuleInput): Promise<void> {
    this.commit(mut.updateRule(this.snap, id, input))
  }
  async setRuleActive(id: UUID, active: boolean): Promise<void> {
    this.commit(mut.setRuleActive(this.snap, id, active))
  }
  async deleteRule(id: UUID): Promise<void> {
    this.commit(mut.deleteRule(this.snap, id))
  }

  // ---- 奖励 ----
  async addReward(input: RewardInput): Promise<void> {
    this.commit(mut.addReward(this.snap, input, this.childID, new Date()).snap)
  }
  async updateReward(id: UUID, input: RewardInput): Promise<void> {
    this.commit(mut.updateReward(this.snap, id, input))
  }
  async setRewardActive(id: UUID, active: boolean): Promise<void> {
    this.commit(mut.setRewardActive(this.snap, id, active))
  }
  async deleteReward(id: UUID): Promise<void> {
    this.commit(mut.deleteReward(this.snap, id))
  }

  // ---- 记分 / 撤销 ----
  async recordScore(ruleID: UUID, note: string | null, at: Date = new Date()): Promise<boolean> {
    const r = mut.recordScore(this.snap, ruleID, note, at, this.childID)
    if (r.ok) this.commit(r.snap)
    return r.ok
  }
  async undoLastEvent(): Promise<ScoreEvent | null> {
    const r = mut.undoLastEvent(this.snap)
    if (r.undone) this.commit(r.snap)
    return r.undone
  }

  // ---- 兑换 ----
  async requestRedemption(rewardID: UUID, at: Date = new Date()): Promise<boolean> {
    const r = mut.requestRedemption(this.snap, rewardID, at, this.childID)
    if (r.ok) this.commit(r.snap)
    return r.ok
  }
  async approveRedemption(id: UUID, at: Date = new Date()): Promise<boolean> {
    const r = mut.approveRedemption(this.snap, id, at)
    if (r.ok) this.commit(r.snap)
    return r.ok
  }
  async rejectRedemption(id: UUID, at: Date = new Date()): Promise<void> {
    this.commit(mut.rejectRedemption(this.snap, id, at))
  }

  // ---- 孩子档案 ----
  async renameChild(name: string): Promise<void> {
    this.commit(mut.renameChild(this.snap, name))
  }
  async setAvatar(symbol: string): Promise<void> {
    this.commit(mut.setAvatar(this.snap, symbol))
  }

  // ---- 维护 ----
  async clearScores(): Promise<void> {
    this.commit(mut.clearScores(this.snap))
  }

  /** 首启 seed：只种孩子+规则+奖励（无流水，余额 0）——对位 iOS seedSampleDataIfNeeded。 */
  async seedIfEmpty(childName: string = '', now: Date = new Date()): Promise<void> {
    if (this.snap.child) return
    const bundle = makeSampleBundle(now, this.childID)
    this.commit({
      child: {
        ...bundle.child,
        name: childName.trim() || this.localize('宝贝'),
        avatarSymbol: 'DefaultAvatar',
        createdAt: now,
      },
      rules: bundle.rules.map((r) => ({ ...r, name: this.localize(r.name) })),
      rewards: bundle.rewards.map((r) => ({ ...r, name: this.localize(r.name) })),
      events: [],
      redemptions: [],
    })
  }

  async resetAndSeed(childName: string = '', now: Date = new Date()): Promise<void> {
    this.snap = EMPTY_SNAPSHOT
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

  async importBundle(bundle: BackupBundle, replace: boolean): Promise<void> {
    if (!replace) {
      // MVP 与 iOS 相同：仅支持整体替换语义；merge 留待需要时实现
    }
    this.commit({
      child: bundle.children[0] ?? null,
      rules: bundle.rules,
      rewards: bundle.rewards,
      events: bundle.events,
      redemptions: bundle.redemptions,
    })
  }

  // ---- PIN ----
  isPINSet(): boolean {
    return this.storage.getItem(PIN_KEY) !== null
  }
  async setPIN(pin: string): Promise<void> {
    this.storage.setItem(PIN_KEY, await encodePinBlob(pin))
    // isPINSet 变化要驱动 UI（引导门依赖它）；useSyncExternalStore 按快照引用判变，须换新引用
    this.snap = { ...this.snap }
    this.listeners.forEach((l) => l())
  }
  async verifyPIN(pin: string): Promise<boolean> {
    const blob = this.storage.getItem(PIN_KEY)
    if (!blob) return false
    return verifyPinBlob(pin, blob)
  }
}
