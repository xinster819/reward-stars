import { describe, it, expect } from 'vitest'
import { renderEmail, encodeMimeWord } from '../render'
import type { WeeklySummary } from '../summary'

/** 按 RFC2047 解码回来（相邻 encoded-word 之间的空格应被忽略）。 */
function decodeMimeWords(s: string): string {
  return s
    .split(' ')
    .map((w) => {
      const m = /^=\?UTF-8\?B\?(.*)\?=$/.exec(w)
      if (!m) return w
      const bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0))
      return new TextDecoder().decode(bytes)
    })
    .join('')
}

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

// 回归：denomailer 对非 ASCII header 会用 QP 软换行（`=` 结尾）折行，那在 header 里非法，
// 会把 header 区截断、导致整封 MIME 被当正文显示。对策：我们自己编成纯 ASCII 的 encoded-word。
describe('encodeMimeWord — RFC2047 header 编码', () => {
  it('纯 ASCII 原样返回（denomailer 不会再碰它）', () => {
    expect(encodeMimeWord('Reward Stars')).toBe('Reward Stars')
    expect(encodeMimeWord('7/6-7/12')).toBe('7/6-7/12')
  })

  it('中文编成合规 encoded-word 且能解回原文', () => {
    const src = '小明 上周积分周报 6/29-7/5'
    const out = encodeMimeWord(src)
    expect(out).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=( =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=)*$/)
    expect(decodeMimeWords(out)).toBe(src)
  })

  it('输出必须是纯 ASCII（否则 denomailer 又会去 QP 编码）', () => {
    const out = encodeMimeWord('别忘了给 小明 记分')
    // eslint-disable-next-line no-control-regex
    expect(/^[\x20-\x7E]*$/.test(out)).toBe(true)
  })

  it('每段 encoded-word ≤75 字符（RFC2047 硬限制）', () => {
    const out = encodeMimeWord('小明'.repeat(60))
    for (const w of out.split(' ')) expect(w.length).toBeLessThanOrEqual(75)
  })

  it('超长文本切多段后仍能完整解回（不得在多字节字符中间切断）', () => {
    const src = '积分周报'.repeat(40)
    expect(decodeMimeWords(encodeMimeWord(src))).toBe(src)
  })

  it('emoji（代理对）不被切坏', () => {
    const src = '📊📈📉 小明 上周积分周报'
    expect(decodeMimeWords(encodeMimeWord(src))).toBe(src)
  })

  it('encoded-word 内部不含空格（含空格即非法）', () => {
    const out = encodeMimeWord('小明 上周积分周报')
    for (const w of out.split(' ')) {
      if (w.startsWith('=?')) expect(w).not.toMatch(/\?B\?[^?]* /)
    }
  })
})

describe('renderEmail — 主题必须短且可安全编码', () => {
  it('report 主题编码后单段即可装下（避免 denomailer 折行）', () => {
    const out = encodeMimeWord(renderEmail(base, { appUrl: 'https://app.example', mode: 'report' }).subject)
    expect(out.split(' ').length).toBe(1)
    expect(out.length).toBeLessThanOrEqual(75)
  })
  it('nudge 主题同样单段', () => {
    const out = encodeMimeWord(renderEmail({ ...base, weekHasActivity: false }, { appUrl: 'https://app.example', mode: 'nudge' }).subject)
    expect(out.split(' ').length).toBe(1)
    expect(out.length).toBeLessThanOrEqual(75)
  })
})

describe('renderEmail — pendingCount 为 0 时不出现行动提醒', () => {
  const r = renderEmail({ ...base, pendingCount: 0 }, { appUrl: 'https://app.example', mode: 'report' })
  it('无待审批提醒', () => {
    expect(r.html).not.toContain('待你审批')
  })
})
