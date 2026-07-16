// 周报邮件渲染 —— 零依赖纯函数。邮件安全：全内联样式，无外链 JS/CSS、无远程图片。
import type { WeeklySummary, Cat } from './summary.ts'

export interface RenderOpts {
  appUrl: string
  mode: 'report' | 'nudge'
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

const CAT_LABEL: Record<Cat, string> = { learning: '学习', life: '生活', character: '品德', other: '其他' }

const ACCENT = '#FF9500'
const POS = '#34C759'
const NEG = '#FF3B30'
const INK = '#1c1c1e'
const MUTE = '#8e8e93'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${m}月${d}日`
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

function deltaText(delta: number): string {
  if (delta > 0) return `较上周 ↑${delta}`
  if (delta < 0) return `较上周 ↓${Math.abs(delta)}`
  return '与上周持平'
}

/** 7 天趋势条：纯 table + 内联背景色，邮件客户端安全。 */
function trendHtml(trend: WeeklySummary['dailyTrend']): string {
  const maxAbs = Math.max(1, ...trend.map((d) => Math.abs(d.net)))
  const cells = trend.map((d) => {
    const h = Math.round((Math.abs(d.net) / maxAbs) * 48)
    const color = d.net >= 0 ? POS : NEG
    const bar = d.net === 0
      ? `<div style="height:2px;width:14px;background:#e5e5ea;border-radius:1px;"></div>`
      : `<div style="height:${h}px;width:14px;background:${color};border-radius:3px;"></div>`
    const wd = ['一', '二', '三', '四', '五', '六', '日'][(new Date(d.date + 'T00:00:00Z').getUTCDay() + 6) % 7]
    return `<td style="vertical-align:bottom;text-align:center;padding:0 3px;">
      <div style="height:52px;display:flex;align-items:flex-end;justify-content:center;">${bar}</div>
      <div style="font-size:11px;color:${MUTE};margin-top:4px;">${wd}</div>
      <div style="font-size:11px;color:${INK};">${d.net === 0 ? '·' : signed(d.net)}</div>
    </td>`
  }).join('')
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0;"><tr>${cells}</tr></table>`
}

function categoryHtml(byCategory: WeeklySummary['byCategory']): string {
  const rows = (Object.keys(CAT_LABEL) as Cat[])
    .filter((c) => byCategory[c] !== 0)
    .map((c) => {
      const v = byCategory[c]
      return `<tr>
        <td style="padding:2px 0;color:${INK};font-size:14px;">${CAT_LABEL[c]}</td>
        <td style="padding:2px 0;text-align:right;font-weight:600;color:${v >= 0 ? POS : NEG};font-size:14px;">${signed(v)}</td>
      </tr>`
    }).join('')
  return rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` : `<p style="color:${MUTE};font-size:13px;margin:0;">本周暂无分类记录</p>`
}

function section(title: string, body: string): string {
  return `<div style="margin:18px 0;">
    <div style="font-size:13px;color:${MUTE};margin-bottom:6px;">${title}</div>
    ${body}
  </div>`
}

function shell(inner: string, appUrl: string): string {
  return `<!doctype html>
<html lang="zh"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
</head><body style="margin:0;padding:0;">
<div style="background:#f2f2f7;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;">
    <div style="background:${ACCENT};padding:20px 24px;">
      <div style="color:#ffffff;font-size:20px;font-weight:700;">⭐ 行为奖励 · 每周积分周报</div>
    </div>
    <div style="padding:8px 24px 24px;">
      ${inner}
    </div>
    <div style="padding:16px 24px;background:#fafafa;text-align:center;">
      <a href="${esc(appUrl)}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:11px 22px;border-radius:12px;">打开 App</a>
      <p style="color:${MUTE};font-size:12px;margin:14px 0 0;line-height:1.5;">想关闭每周周报邮件？在 App 的「家长设置 → 通知」里可随时关闭。</p>
    </div>
  </div>
</div>
</body></html>`
}

function renderReport(s: WeeklySummary, appUrl: string): RenderedEmail {
  const name = esc(s.child.name)
  const range = `${fmtDate(s.weekStartDate)}–${fmtDate(s.weekEndDate)}`
  const subject = `📊 ${s.child.name} 上周积分周报（${range}）`

  const badges = s.newBadges.length
    ? section('本周新解锁徽章', s.newBadges.map((b) => `<span style="display:inline-block;background:#fff4e5;color:${ACCENT};border-radius:10px;padding:6px 12px;font-size:13px;font-weight:600;margin:0 6px 6px 0;">🏅 ${esc(b.title)} · ${esc(b.detail)}</span>`).join(''))
    : ''

  const pending = s.pendingCount > 0
    ? `<div style="background:#fff4e5;border-radius:12px;padding:12px 14px;margin-top:8px;color:${INK};font-size:14px;">⏳ 有 <b>${s.pendingCount}</b> 笔兑换待你审批</div>`
    : ''
  const approved = s.approvedThisWeek.length
    ? `<div style="font-size:14px;color:${INK};">本周已兑换：${s.approvedThisWeek.map((r) => `${esc(r.rewardName)}（${r.cost} 分）`).join('、')}</div>`
    : `<div style="font-size:14px;color:${MUTE};">本周没有兑换记录</div>`

  const top = s.topPositive.length
    ? `<ul style="margin:0;padding-left:18px;color:${INK};font-size:14px;">${s.topPositive.map((p) => `<li>${esc(p.ruleName)} ×${p.count}（${signed(p.total)}）</li>`).join('')}</ul>`
    : `<p style="color:${MUTE};font-size:13px;margin:0;">本周暂无正向记录</p>`
  const pen = s.penalties.length
    ? `<div style="margin-top:8px;"><div style="font-size:13px;color:${MUTE};margin-bottom:4px;">需要注意</div><ul style="margin:0;padding-left:18px;color:${NEG};font-size:14px;">${s.penalties.map((p) => `<li>${esc(p.ruleName)}（${p.points}）${p.note ? ` · ${esc(p.note)}` : ''}</li>`).join('')}</ul></div>`
    : ''

  const inner = `
    <p style="font-size:15px;color:${INK};margin:12px 0 4px;">${name} 的一周（${range}）</p>
    <div style="display:flex;gap:12px;margin:12px 0;">
      <div style="flex:1;background:#f2fbf4;border-radius:14px;padding:14px;">
        <div style="font-size:13px;color:${MUTE};">本周净得分</div>
        <div style="font-size:28px;font-weight:700;color:${s.weekNet >= 0 ? POS : NEG};">${signed(s.weekNet)}</div>
        <div style="font-size:12px;color:${MUTE};">${deltaText(s.netDelta)}</div>
      </div>
      <div style="flex:1;background:#fff8f0;border-radius:14px;padding:14px;">
        <div style="font-size:13px;color:${MUTE};">当前余额</div>
        <div style="font-size:28px;font-weight:700;color:${ACCENT};">${s.balance}</div>
        <div style="font-size:12px;color:${MUTE};">🔥 连续 ${s.streak} 天正向</div>
      </div>
    </div>
    ${section('7 天趋势', trendHtml(s.dailyTrend))}
    ${section('本周分类拆分', categoryHtml(s.byCategory))}
    ${badges}
    ${section('本周亮点', top + pen)}
    ${section('奖励兑换', approved + pending)}
  `

  const text = [
    `${s.child.name} 上周积分周报（${range}）`,
    `本周净得分：${signed(s.weekNet)}（${deltaText(s.netDelta)}）`,
    `当前余额：${s.balance}　连续 ${s.streak} 天正向`,
    s.newBadges.length ? `新徽章：${s.newBadges.map((b) => b.title).join('、')}` : '',
    s.topPositive.length ? `亮点：${s.topPositive.map((p) => `${p.ruleName}×${p.count}`).join('、')}` : '',
    s.penalties.length ? `需注意：${s.penalties.map((p) => `${p.ruleName}(${p.points})`).join('、')}` : '',
    s.pendingCount > 0 ? `有 ${s.pendingCount} 笔兑换待审批` : '',
    `打开 App：${appUrl}`,
    `关闭周报：App「家长设置 → 通知」`,
  ].filter(Boolean).join('\n')

  return { subject, html: shell(inner, appUrl), text }
}

function renderNudge(s: WeeklySummary, appUrl: string): RenderedEmail {
  const name = esc(s.child.name)
  const subject = `👋 别忘了给 ${s.child.name} 记分哦`
  const inner = `
    <p style="font-size:16px;color:${INK};margin:16px 0 8px;">${name} 本周还没有任何积分记录～</p>
    <p style="font-size:14px;color:${MUTE};line-height:1.6;">好习惯贵在坚持。打开 App 给 ${name} 记分，让这周的努力被看见吧。</p>
  `
  const text = `${s.child.name} 本周还没有记分。打开 App 记一次分吧：${appUrl}\n关闭周报：App「家长设置 → 通知」`
  return { subject, html: shell(inner, appUrl), text }
}

export function renderEmail(summary: WeeklySummary, opts: RenderOpts): RenderedEmail {
  return opts.mode === 'nudge' ? renderNudge(summary, opts.appUrl) : renderReport(summary, opts.appUrl)
}
