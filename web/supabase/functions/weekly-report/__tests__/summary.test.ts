// summary.ts 测试：
//  - 平价：tz='UTC' + Date.UTC 构造 → summary 的墙上日期==UTC 日历日，可与「基于瞬时、时区无关」
//    的权威引擎函数（netPoints/balance/cumulativeEarned）对齐。
//  - tz 分桶：用显式 Asia/Shanghai 期望，断言与机器时区无关。
import { describe, it, expect } from 'vitest'
import { buildWeeklySummary, decideAction, type RedIn, type EvIn } from '../summary'
import { balance as domainBalance, netPoints, cumulativeEarned } from '../../../../src/domain/scoringEngine'
import type { RedemptionRequest, ScoreEvent, ScoreCategory } from '../../../../src/domain/types'

const U = (y: number, m: number, day: number, h = 12) => new Date(Date.UTC(y, m - 1, day, h)).toISOString()
const ev = (points: number, tsISO: string, o: Partial<EvIn> = {}): EvIn => ({
  points, category: o.category ?? 'learning', ts: tsISO, isVoided: o.isVoided ?? false, ruleName: o.ruleName ?? 'rule', note: o.note ?? null,
})
const red = (cost: number, status: RedIn['status'], decidedAt: string | null, rewardName = 'reward'): RedIn => ({ rewardName, cost, status, decidedAt })
const child = { id: 'c1', name: '小明', avatarSymbol: 'teddybear.fill' }
// 2026-07-06 是周一（UTC）→ 报告周（上一整周）= 2026-06-29(一) .. 2026-07-05(日)
const NOW = new Date(Date.UTC(2026, 6, 6, 0))

const toDomainEvents = (evs: EvIn[]): ScoreEvent[] =>
  evs.map((e, i) => ({ id: String(i), ruleID: null, ruleName: e.ruleName, category: e.category as ScoreCategory, points: e.points, note: e.note, timestamp: new Date(e.ts), childID: 'c1', isVoided: e.isVoided }))
const toDomainReds = (rs: RedIn[]): RedemptionRequest[] =>
  rs.map((r, i) => ({ id: String(i), rewardID: null, rewardName: r.rewardName, cost: r.cost, status: r.status, requestedAt: new Date(), decidedAt: r.decidedAt ? new Date(r.decidedAt) : null, childID: 'c1' }))

describe('buildWeeklySummary — window / parity (tz=UTC)', () => {
  const events = [
    ev(10, U(2026, 6, 30)),                 // 本周二 +10
    ev(-5, U(2026, 7, 1), { category: 'other', note: '早上赖床', ruleName: '拖延磨蹭' }), // 本周三 -5
    ev(8, U(2026, 7, 3)),                   // 本周五 +8
    ev(6, U(2026, 6, 22)),                  // 上上周 +6（不计入本周）
    ev(99, U(2026, 6, 30), { isVoided: true }), // 作废，全程排除
  ]
  const reds = [red(20, 'approved', U(2026, 7, 2), '看30分钟电视'), red(5, 'pending', null)]
  const s = buildWeeklySummary({ child, events, redemptions: reds, tz: 'UTC', now: NOW })

  it('报告周 = 上一整周（含端墙上日期）', () => {
    expect(s.weekStartDate).toBe('2026-06-29')
    expect(s.weekEndDate).toBe('2026-07-05')
  })
  it('weekNet 与 netPoints 一致，且排除 voided/窗口外', () => {
    const interval = { start: new Date(Date.UTC(2026, 5, 29)), end: new Date(Date.UTC(2026, 6, 6)) }
    expect(s.weekNet).toBe(netPoints(toDomainEvents(events), interval))
    expect(s.weekNet).toBe(13)
  })
  it('prevWeekNet 与 netDelta', () => {
    expect(s.prevWeekNet).toBe(6)
    expect(s.netDelta).toBe(7)
  })
  it('balance 与权威一致（全时，含上上周，扣 approved 花费）', () => {
    expect(s.balance).toBe(domainBalance(toDomainEvents(events), toDomainReds(reds)))
    expect(s.balance).toBe(-1) // (10-5+8+6) - 20
  })
  it('byCategory 本周拆分', () => {
    expect(s.byCategory.learning).toBe(18) // 10 + 8
    expect(s.byCategory.other).toBe(-5)
    expect(s.byCategory.life).toBe(0)
  })
  it('dailyTrend 7 天，最旧在前，无事件占位 0', () => {
    expect(s.dailyTrend.map((d) => d.date)).toEqual(['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05'])
    expect(s.dailyTrend.find((d) => d.date === '2026-06-30')!.net).toBe(10)
    expect(s.dailyTrend.find((d) => d.date === '2026-06-29')!.net).toBe(0)
  })
  it('兑换：本周 approved + 当前 pending 数', () => {
    expect(s.approvedThisWeek).toEqual([{ rewardName: '看30分钟电视', cost: 20 }])
    expect(s.pendingCount).toBe(1)
  })
  it('亮点：topPositive 与 penalties', () => {
    expect(s.topPositive[0]).toEqual({ ruleName: 'rule', count: 2, total: 18 })
    expect(s.penalties).toEqual([{ ruleName: '拖延磨蹭', points: -5, note: '早上赖床' }])
  })
  it('hasAnyHistory / weekHasActivity', () => {
    expect(s.hasAnyHistory).toBe(true)
    expect(s.weekHasActivity).toBe(true)
  })
})

describe('buildWeeklySummary — tz 分桶（Asia/Shanghai，与机器时区无关）', () => {
  // 2026-06-29T23:00Z = 06-30 07:00 (UTC+8) → 归入 06-30；2026-06-30T02:00Z = 06-30 10:00 → 也归 06-30
  const events = [ev(5, '2026-06-29T23:00:00.000Z'), ev(7, '2026-06-30T02:00:00.000Z')]
  const s = buildWeeklySummary({ child, events, redemptions: [], tz: 'Asia/Shanghai', now: NOW })
  it('跨 UTC 日界的事件按本地墙上日期归桶', () => {
    expect(s.dailyTrend.find((d) => d.date === '2026-06-30')!.net).toBe(12)
    expect(s.dailyTrend.find((d) => d.date === '2026-06-29')!.net).toBe(0)
  })
})

describe('buildWeeklySummary — 新徽章（里程碑）', () => {
  // 期初累计 45（Jun20），本周 +10（Jun30）→ 期末 55 越过 50 → 新解锁 milestone_50
  const events = [ev(45, U(2026, 6, 20)), ev(10, U(2026, 6, 30))]
  const s = buildWeeklySummary({ child, events, redemptions: [], tz: 'UTC', now: NOW })
  it('本周越过 50 分里程碑', () => {
    expect(s.newBadges.map((b) => b.id)).toEqual(['milestone_50'])
    // 与权威一致：期末累计达阈值、期初未达
    expect(cumulativeEarned(toDomainEvents(events))).toBe(55)
  })
})

describe('buildWeeklySummary — 连击（tz=UTC）', () => {
  // 报告周内 Jul3/4/5 连续 3 天正向 → streak=3（自上周日 Jul5 起回数）
  const events = [ev(5, U(2026, 7, 3)), ev(5, U(2026, 7, 4)), ev(5, U(2026, 7, 5))]
  const s = buildWeeklySummary({ child, events, redemptions: [], tz: 'UTC', now: NOW })
  it('连续 3 天 → streak=3 且解锁三连击', () => {
    expect(s.streak).toBe(3)
    expect(s.newBadges.map((b) => b.id)).toContain('streak_3')
  })
})

describe('buildWeeklySummary — 空账号', () => {
  const s = buildWeeklySummary({ child, events: [], redemptions: [], tz: 'UTC', now: NOW })
  it('无任何历史', () => {
    expect(s.hasAnyHistory).toBe(false)
    expect(s.weekHasActivity).toBe(false)
    expect(s.weekNet).toBe(0)
  })
})

describe('decideAction — 空档分流', () => {
  it('关闭 → skip_disabled', () => expect(decideAction({ enabled: false, alreadySent: false, hasAnyHistory: true, weekHasActivity: true })).toBe('skip_disabled'))
  it('已发过 → skip_already', () => expect(decideAction({ enabled: true, alreadySent: true, hasAnyHistory: true, weekHasActivity: true })).toBe('skip_already'))
  it('从未记分 → skip_empty', () => expect(decideAction({ enabled: true, alreadySent: false, hasAnyHistory: false, weekHasActivity: false })).toBe('skip_empty'))
  it('有历史但本周静默 → nudge', () => expect(decideAction({ enabled: true, alreadySent: false, hasAnyHistory: true, weekHasActivity: false })).toBe('nudge'))
  it('本周有活动 → send', () => expect(decideAction({ enabled: true, alreadySent: false, hasAnyHistory: true, weekHasActivity: true })).toBe('send'))
})
