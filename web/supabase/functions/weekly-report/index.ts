// Edge Function「weekly-report」(Deno)：pg_cron 每周一触发 → 遍历每个家庭 → 生成上一整周积分周报
// → 经 Gmail SMTP 投递 → report_log 幂等去重。积分口径全部委托给零依赖纯函数 summary.ts（与 web/src/domain 守恒）。
//
// 触发保护：必须带 x-cron-secret == CRON_SECRET。
// 环境变量：SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（平台自带）、CRON_SECRET、
//           GMAIL_USER（发件 Gmail 地址）、GMAIL_APP_PASSWORD（16 位应用专用密码，需账号开 2FA）、
//           SMTP_HOST（默认 smtp.gmail.com）、SMTP_PORT（默认 465）、
//           REPORT_TZ（默认 Asia/Shanghai）、APP_URL、REPORT_FROM（默认「行为奖励 <GMAIL_USER>」）。
// 日志纪律：只记 family_id + status，绝不打印密钥或邮件正文/PII。
//
// 本文件为 Deno 运行时，不参与 web 的 tsc app build（tsconfig.app.json 仅 include src）。
// 部署与手动触发见同目录 README.md。

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import { buildWeeklySummary, decideAction, type EvIn, type RedIn, type ChildIn } from './summary.ts'
import { renderEmail, encodeMimeWord } from './render.ts'

// deno-lint-ignore no-explicit-any
type Row = any

const REPORT_TZ = Deno.env.get('REPORT_TZ') ?? 'Asia/Shanghai'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.example'
const GMAIL_USER = Deno.env.get('GMAIL_USER')
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')
const SMTP_HOST = Deno.env.get('SMTP_HOST') ?? 'smtp.gmail.com'
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') ?? '465')
// Gmail 要求 From 地址 = 认证账号（或已设置的 send-as 别名）。默认用 GMAIL_USER。
// 显示名默认用【纯 ASCII】：非 ASCII 显示名同样会被 denomailer 的 header 编码器折坏（见 render.ts encodeMimeWord）。
const REPORT_FROM = Deno.env.get('REPORT_FROM') ?? (GMAIL_USER ? `Reward Stars <${GMAIL_USER}>` : 'Reward Stars')

/** 把 `显示名 <addr>` 里的显示名按 RFC2047 编码；地址部分原样保留。 */
function encodeFromHeader(from: string): string {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from)
  if (!m) return encodeMimeWord(from)
  const name = m[1].replace(/^"|"$/g, '').trim()
  return name ? `${encodeMimeWord(name)} <${m[2].trim()}>` : `<${m[2].trim()}>`
}

function rowToEv(r: Row): EvIn {
  return { points: r.points, category: r.category, ts: r.ts, isVoided: r.is_voided, ruleName: r.rule_name, note: r.note ?? null }
}
function rowToRed(r: Row): RedIn {
  return { rewardName: r.reward_name, cost: r.cost, status: r.status, decidedAt: r.decided_at ?? null }
}
function rowToChild(r: Row): ChildIn {
  return { id: r.id, name: r.name, avatarSymbol: r.avatar_symbol }
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('unauthorized', { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceRole)

  // Gmail SMTP：连接懒建、循环内复用，最后统一关闭。
  let smtp: SMTPClient | null = null
  const sendEmail = async (to: string, subject: string, html: string, text: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      if (!smtp) {
        smtp = new SMTPClient({
          connection: { hostname: SMTP_HOST, port: SMTP_PORT, tls: true, auth: { username: GMAIL_USER!, password: GMAIL_APP_PASSWORD! } },
        })
      }
      // subject/from 必须是纯 ASCII（已 RFC2047 编码），否则 denomailer 会在 header 里非法折行
      await smtp.send({ from: encodeFromHeader(REPORT_FROM), to, subject: encodeMimeWord(subject), content: text, html })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: 'smtp_' + (e instanceof Error ? e.message.slice(0, 80) : 'error') }
    }
  }

  // ?force=1：忽略 report_log 幂等，强制重发（仅供自测；仍受 x-cron-secret 保护）
  const force = new URL(req.url).searchParams.get('force') === '1'

  const now = new Date()
  // 报告周起始（上周一）——只依赖 tz+now，用空数据探针取一次。
  const probe = buildWeeklySummary({ child: { id: '', name: '', avatarSymbol: '' }, events: [], redemptions: [], tz: REPORT_TZ, now })
  const weekStart = probe.weekStartDate

  const counts = { weekStart, sent: 0, nudged: 0, skip_empty: 0, skip_disabled: 0, skip_already: 0, failed: 0 }

  // 全部家庭 + 开关
  const { data: families, error: famErr } = await admin.from('families').select('id, weekly_report_enabled')
  if (famErr) return Response.json({ error: 'families_query_failed' }, { status: 500 })

  // 本报告周已发过（sent/nudged）的家庭集合——一次查询，供幂等判定。
  const { data: doneRows } = await admin.from('report_log').select('family_id').eq('week_start', weekStart).in('status', ['sent', 'nudged'])
  const alreadyDone = new Set<string>((doneRows ?? []).map((r: Row) => r.family_id))

  // 邮箱映射：family_id(=auth.users.id) → email，分页拉取。
  const emailByFamily = new Map<string, string>()
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data || data.users.length === 0) break
    for (const u of data.users) if (u.email) emailByFamily.set(u.id, u.email)
    if (data.users.length < 1000) break
  }

  const record = async (familyId: string, status: string, detail: string | null) => {
    await admin.from('report_log').upsert(
      { family_id: familyId, week_start: weekStart, status, detail, sent_at: new Date().toISOString() },
      { onConflict: 'family_id,week_start' },
    )
  }

  for (const fam of families ?? []) {
    const familyId: string = fam.id
    try {
      const enabled: boolean = fam.weekly_report_enabled ?? true
      const alreadySent = force ? false : alreadyDone.has(familyId)

      // 拉该家数据（service_role 绕 RLS）
      const [childrenRes, eventsRes, redRes] = await Promise.all([
        admin.from('children').select('id, name, avatar_symbol').eq('family_id', familyId).order('created_at'),
        admin.from('events').select('points, category, ts, is_voided, rule_name, note').eq('family_id', familyId),
        admin.from('redemptions').select('reward_name, cost, status, decided_at').eq('family_id', familyId),
      ])
      const childRow = (childrenRes.data ?? [])[0]
      if (!childRow) { counts.skip_empty++; await record(familyId, 'skip_empty', 'no_child'); continue }

      const summary = buildWeeklySummary({
        child: rowToChild(childRow),
        events: (eventsRes.data ?? []).map(rowToEv),
        redemptions: (redRes.data ?? []).map(rowToRed),
        tz: REPORT_TZ,
        now,
      })

      const action = decideAction({ enabled, alreadySent, hasAnyHistory: summary.hasAnyHistory, weekHasActivity: summary.weekHasActivity })

      if (action === 'skip_disabled') { counts.skip_disabled++; await record(familyId, 'skip_disabled', null); continue }
      if (action === 'skip_already') { counts.skip_already++; continue } // 已有记录，不重复写
      if (action === 'skip_empty') { counts.skip_empty++; await record(familyId, 'skip_empty', null); continue }

      const email = emailByFamily.get(familyId)
      if (!email) { counts.failed++; await record(familyId, 'failed', 'no_email'); continue }
      if (!GMAIL_USER || !GMAIL_APP_PASSWORD) { counts.failed++; await record(familyId, 'failed', 'no_smtp_creds'); continue }

      const mode = action === 'send' ? 'report' : 'nudge'
      const { subject, html, text } = renderEmail(summary, { appUrl: APP_URL, mode })
      const res = await sendEmail(email, subject, html, text)
      if (!res.ok) { counts.failed++; await record(familyId, 'failed', res.error ?? 'send_failed'); continue }

      if (action === 'send') { counts.sent++; await record(familyId, 'sent', null) }
      else { counts.nudged++; await record(familyId, 'nudged', null) }
    } catch (e) {
      counts.failed++
      await record(familyId, 'failed', 'exception').catch(() => {})
      console.error('[weekly-report] family', familyId, 'failed:', e instanceof Error ? e.message : String(e))
    }
  }

  if (smtp) { try { await smtp.close() } catch { /* 忽略关闭异常 */ } }

  console.log('[weekly-report] done', JSON.stringify(counts))
  return Response.json(counts)
})
