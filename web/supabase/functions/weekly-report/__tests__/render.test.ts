import { describe, it, expect } from 'vitest'
import { renderEmail } from '../render'
import type { WeeklySummary } from '../summary'

const base: WeeklySummary = {
  child: { id: 'c1', name: '小明', avatarSymbol: 'teddybear.fill' },
  weekStartDate: '2026-06-29',
  weekEndDate: '2026-07-05',
  hasAnyHistory: true,
  weekHasActivity: true,
  weekNet: 13,
  prevWeekNet: 5,
  netDelta: 8,
  balance: 74,
  byCategory: { learning: 18, life: 0, character: 0, other: -5 },
  dailyTrend: [
    { date: '2026-06-29', net: 0 },
    { date: '2026-06-30', net: 10 },
    { date: '2026-07-01', net: -5 },
    { date: '2026-07-02', net: 0 },
    { date: '2026-07-03', net: 8 },
    { date: '2026-07-04', net: 0 },
    { date: '2026-07-05', net: 0 },
  ],
  streak: 2,
  newBadges: [{ id: 'milestone_50', title: '起步星', detail: '累计获得 50 分' }],
  approvedThisWeek: [{ rewardName: '看30分钟电视', cost: 20 }],
  pendingCount: 1,
  topPositive: [{ ruleName: '认真完成作业', count: 1, total: 10 }],
  penalties: [{ ruleName: '拖延磨蹭', points: -5, note: '早上赖床' }],
}

describe('renderEmail — report', () => {
  const r = renderEmail(base, { appUrl: 'https://app.example', mode: 'report' })

  it('主题含孩子名与周期月份', () => {
    expect(r.subject).toContain('小明')
    expect(r.subject).toContain('6')
  })
  it('正文含本周净分/余额/新徽章', () => {
    expect(r.html).toContain('13')
    expect(r.html).toContain('74')
    expect(r.html).toContain('起步星')
  })
  it('待审批行动提醒', () => {
    expect(r.html).toContain('待你审批')
  })
  it('含亮点与扣分事项', () => {
    expect(r.html).toContain('认真完成作业')
    expect(r.html).toContain('拖延磨蹭')
  })
  it('无远程资源、无脚本（邮件安全）', () => {
    expect(r.html).not.toMatch(/src\s*=\s*["']https?:/i)
    expect(r.html).not.toMatch(/<script/i)
    expect(r.html).not.toMatch(/<link/i)
  })
  it('声明 UTF-8 charset（CJK 跨邮件客户端稳健）', () => {
    expect(r.html).toMatch(/charset=["']?utf-8/i)
  })
  it('含打开 App 链接与退订说明', () => {
    expect(r.html).toContain('https://app.example')
    expect(r.html).toContain('关闭')
  })
  it('text 纯文本兜底非空且含净分', () => {
    expect(r.text.length).toBeGreaterThan(10)
    expect(r.text).toContain('13')
  })
})

describe('renderEmail — nudge', () => {
  const r = renderEmail({ ...base, weekHasActivity: false }, { appUrl: 'https://app.example', mode: 'nudge' })

  it('主题含孩子名', () => {
    expect(r.subject).toContain('小明')
  })
  it('正文引导记分且含 App 链接', () => {
    expect(r.html).toContain('记分')
    expect(r.html).toContain('https://app.example')
  })
  it('不含具体净分数字块（nudge 不报数据）', () => {
    expect(r.html).not.toContain('本周净得分')
  })
})

describe('renderEmail — pendingCount 为 0 时不出现行动提醒', () => {
  const r = renderEmail({ ...base, pendingCount: 0 }, { appUrl: 'https://app.example', mode: 'report' })
  it('无待审批提醒', () => {
    expect(r.html).not.toContain('待你审批')
  })
})
