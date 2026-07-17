import { describe, it, expect } from 'vitest'
import { renderEmail } from '../render'
import type { WeeklySummary } from '../summary'

const isAscii = (s: string) => /^[\x20-\x7E]*$/.test(s)

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

  it('主题含周期，便于识别', () => {
    expect(r.subject).toContain('6/29')
    expect(r.subject).toContain('7/5')
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

  it('主题可识别为提醒', () => {
    expect(r.subject.toLowerCase()).toContain('reminder')
  })
  it('正文引导记分且含 App 链接', () => {
    expect(r.html).toContain('记分')
    expect(r.html).toContain('https://app.example')
  })
  it('不含具体净分数字块（nudge 不报数据）', () => {
    expect(r.html).not.toContain('本周净得分')
  })
})

// ⚠️ 回归护栏 —— 这条测试是两次线上事故换来的，别放宽它：
// 1) denomailer 对【非 ASCII】header 用 quoted-printable 软换行（行尾 `=`）折行，而软换行在 header 里
//    非法 → header 区被截断 → 整封 MIME（From/To/Content-Type/boundary）全被当正文显示。
// 2) denomailer 还会把 header 里的 `=` 编成 `=3D`。而 RFC2047 的 encoded-word（`=?UTF-8?B?..?=`）
//    必然含 `=` → base64 被打乱 → 收件端解不开，标题显示成一坨原文。
// 结论：这条链路上【邮件主题只能是纯 ASCII 且不含 `=`】，没有任何合法的中文写法。
// 想要中文主题，只能换成 API 型邮件服务（Resend 等），由服务端正确生成 MIME。
describe('邮件 header 安全性（回归护栏）', () => {
  const modes = ['report', 'nudge'] as const
  for (const mode of modes) {
    it(`${mode} 主题必须是纯 ASCII`, () => {
      const s = renderEmail({ ...base, weekHasActivity: mode === 'report' }, { appUrl: 'https://app.example', mode }).subject
      expect(isAscii(s)).toBe(true)
    })
    it(`${mode} 主题不得含 '='（会被 denomailer 编成 =3D）`, () => {
      const s = renderEmail({ ...base, weekHasActivity: mode === 'report' }, { appUrl: 'https://app.example', mode }).subject
      expect(s).not.toContain('=')
    })
    it(`${mode} 主题长度受控（避免任何折行）`, () => {
      const s = renderEmail({ ...base, weekHasActivity: mode === 'report' }, { appUrl: 'https://app.example', mode }).subject
      expect(s.length).toBeLessThanOrEqual(70)
    })
  }

  it('孩子名是中文也不会漏进主题（主题不依赖 child.name）', () => {
    const s = renderEmail({ ...base, child: { ...base.child, name: '大若' } }, { appUrl: 'https://app.example', mode: 'report' }).subject
    expect(isAscii(s)).toBe(true)
    expect(s).not.toContain('大若')
  })

  it('中文仍然出现在正文里（body 的 QP 编码是合法的，不受影响）', () => {
    const r = renderEmail(base, { appUrl: 'https://app.example', mode: 'report' })
    expect(r.html).toContain('小明')
    expect(r.html).toContain('本周净得分')
  })
})

describe('renderEmail — pendingCount 为 0 时不出现行动提醒', () => {
  const r = renderEmail({ ...base, pendingCount: 0 }, { appUrl: 'https://app.example', mode: 'report' })
  it('无待审批提醒', () => {
    expect(r.html).not.toContain('待你审批')
  })
})
