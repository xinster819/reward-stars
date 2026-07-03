// 对位 iOS RewardRepositoryTests：记分/撤销/兑换流/清零/改名/CRUD/seed 幂等。

import { beforeEach, describe, expect, it } from 'vitest'
import { LocalRepo } from '../localRepo'
import { balance } from '../../domain/scoringEngine'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  }
}

describe('LocalRepo', () => {
  let repo: LocalRepo
  let storage: Storage

  beforeEach(async () => {
    storage = memoryStorage()
    repo = new LocalRepo(storage)
    await repo.seedIfEmpty('测试娃', new Date(2024, 5, 15, 12))
  })

  const bal = () => balance(repo.getSnapshot().events, repo.getSnapshot().redemptions)

  it('seed is clean start and idempotent', async () => {
    const s = repo.getSnapshot()
    expect(s.child?.name).toBe('测试娃')
    expect(s.rules.length).toBeGreaterThanOrEqual(6)
    expect(s.rewards.length).toBeGreaterThanOrEqual(4)
    expect(s.events).toEqual([]) // 干净起步：无流水
    expect(bal()).toBe(0)
    await repo.seedIfEmpty('别的名字')
    expect(repo.getSnapshot().child?.name).toBe('测试娃') // 幂等
  })

  it('recordScore creates snapshot event and updates balance', async () => {
    const rule = repo.getSnapshot().rules.find((r) => r.points > 0)!
    expect(await repo.recordScore(rule.id, '好样的')).toBe(true)
    const e = repo.getSnapshot().events[0]
    expect(e.ruleName).toBe(rule.name)
    expect(e.points).toBe(rule.points)
    expect(e.note).toBe('好样的')
    expect(bal()).toBe(rule.points)
    // 事后改规则不篡改历史（快照）
    await repo.updateRule(rule.id, { name: '改名了', details: null, category: rule.category, points: 999, iconName: null })
    expect(repo.getSnapshot().events[0].ruleName).toBe(rule.name)
    expect(repo.getSnapshot().events[0].points).toBe(rule.points)
  })

  it('recordScore unknown rule returns false', async () => {
    expect(await repo.recordScore(crypto.randomUUID(), null)).toBe(false)
    expect(repo.getSnapshot().events).toEqual([])
  })

  it('undoLastEvent voids most recent and reverts balance', async () => {
    const rule = repo.getSnapshot().rules.find((r) => r.points > 0)!
    await repo.recordScore(rule.id, null, new Date(2024, 5, 15, 9))
    await repo.recordScore(rule.id, null, new Date(2024, 5, 15, 10))
    const undone = await repo.undoLastEvent()
    expect(undone?.timestamp).toEqual(new Date(2024, 5, 15, 10))
    expect(bal()).toBe(rule.points)
    const s = repo.getSnapshot()
    expect(s.events.filter((e) => e.isVoided).length).toBe(1) // 软删除仍在
  })

  it('redemption flow: pending does not affect balance until approved', async () => {
    const rule = repo.getSnapshot().rules.find((r) => r.points > 0)!
    for (let i = 0; i < 10; i++) await repo.recordScore(rule.id, null)
    const startBal = bal()
    const reward = repo.getSnapshot().rewards.find((r) => r.cost <= startBal)!
    expect(await repo.requestRedemption(reward.id)).toBe(true)
    expect(bal()).toBe(startBal) // pending 不扣
    const req = repo.getSnapshot().redemptions[0]
    expect(await repo.approveRedemption(req.id)).toBe(true)
    expect(bal()).toBe(startBal - reward.cost)
    expect(await repo.approveRedemption(req.id)).toBe(false) // 不能重复审批
  })

  it('approve fails when balance below cost', async () => {
    const reward = repo.getSnapshot().rewards[0]
    await repo.requestRedemption(reward.id)
    const req = repo.getSnapshot().redemptions[0]
    expect(await repo.approveRedemption(req.id)).toBe(false) // 余额 0
    expect(repo.getSnapshot().redemptions[0].status).toBe('pending')
  })

  it('rejectRedemption keeps balance and sets decidedAt', async () => {
    const reward = repo.getSnapshot().rewards[0]
    await repo.requestRedemption(reward.id)
    const req = repo.getSnapshot().redemptions[0]
    await repo.rejectRedemption(req.id, new Date(2024, 5, 16))
    const after = repo.getSnapshot().redemptions[0]
    expect(after.status).toBe('rejected')
    expect(after.decidedAt).toEqual(new Date(2024, 5, 16))
    expect(bal()).toBe(0)
  })

  it('clearScores zeroes balance but keeps rules and rewards', async () => {
    const rule = repo.getSnapshot().rules[0]
    await repo.recordScore(rule.id, null)
    await repo.clearScores()
    const s = repo.getSnapshot()
    expect(s.events).toEqual([])
    expect(s.redemptions).toEqual([])
    expect(s.rules.length).toBeGreaterThan(0)
    expect(s.rewards.length).toBeGreaterThan(0)
    expect(s.child).not.toBeNull()
  })

  it('renameChild trims and ignores empty', async () => {
    await repo.renameChild('  新名字  ')
    expect(repo.getSnapshot().child?.name).toBe('新名字')
    await repo.renameChild('   ')
    expect(repo.getSnapshot().child?.name).toBe('新名字')
  })

  it('rule CRUD with sortOrder auto-increment', async () => {
    const before = repo.getSnapshot().rules.length
    const maxOrder = Math.max(...repo.getSnapshot().rules.map((r) => r.sortOrder))
    await repo.addRule({ name: '新规则', details: '说明', category: 'other', points: 3, iconName: null })
    const added = repo.getSnapshot().rules.find((r) => r.name === '新规则')!
    expect(added.sortOrder).toBe(maxOrder + 1)
    expect(added.iconName).toBe('star.fill') // 类目默认图标
    await repo.setRuleActive(added.id, false)
    expect(repo.getSnapshot().rules.find((r) => r.id === added.id)?.isActive).toBe(false)
    await repo.deleteRule(added.id)
    expect(repo.getSnapshot().rules.length).toBe(before)
  })

  it('persists across instances (localStorage roundtrip)', async () => {
    const rule = repo.getSnapshot().rules[0]
    await repo.recordScore(rule.id, '跨实例')
    const repo2 = new LocalRepo(storage)
    const s = repo2.getSnapshot()
    expect(s.child?.name).toBe('测试娃')
    expect(s.events.length).toBe(1)
    expect(s.events[0].note).toBe('跨实例')
    expect(s.events[0].timestamp instanceof Date).toBe(true)
  })

  it('PIN set/verify via storage blob', async () => {
    expect(repo.isPINSet()).toBe(false)
    await repo.setPIN('1234')
    expect(repo.isPINSet()).toBe(true)
    expect(await repo.verifyPIN('1234')).toBe(true)
    expect(await repo.verifyPIN('0000')).toBe(false)
  })

  it('export/import bundle roundtrip', async () => {
    const rule = repo.getSnapshot().rules[0]
    await repo.recordScore(rule.id, null)
    const bundle = repo.exportBundle(new Date(2024, 5, 20))
    const fresh = new LocalRepo(memoryStorage())
    await fresh.importBundle(bundle, true)
    expect(fresh.getSnapshot().child?.name).toBe('测试娃')
    expect(fresh.getSnapshot().events.length).toBe(1)
  })
})
