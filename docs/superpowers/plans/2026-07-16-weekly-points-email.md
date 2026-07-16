# 每周积分周报邮件服务 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每周一早上，给每个家庭的家长自动发一封"上一整周孩子积分周报"邮件（Supabase Edge Function + pg_cron + Resend）。

**Architecture:** pg_cron（UTC 周一 00:00）经 pg_net 触发 Edge Function「weekly-report」；函数用 service_role 遍历每个家庭，拉上一整周原始 events/redemptions，交给**零依赖纯函数** `summary.ts` 聚合、`render.ts` 渲染邮件，Resend 投递，`report_log` 幂等去重。所有积分口径由 Vitest 平价测试钉死在权威引擎 `web/src/domain/` 上。

**Tech Stack:** TypeScript / Deno（Edge Function）/ Vitest / Supabase(Postgres + pg_cron + pg_net) / Resend REST API / React（家长设置开关）

## Global Constraints

- 只改 `web/` 与 `docs/`；iOS 原生目录（`App/`、`RewardCore/`、`RewardingSystem.xcodeproj` 等）**一律不碰**。
- 积分口径必须与 `web/src/domain/`（`scoringEngine.ts` / `streakCalculator.ts` / `badgeEngine.ts`）一致；`summary.ts` 复刻的公式由平价测试守恒。里程碑阈值 `50/100/200/500`、连击阈值 `3/7`。
- 计分周**周一起算**；报告覆盖**上一整周** `[上周一, 本周一)`，按 `REPORT_TZ`（默认 `Asia/Shanghai`）分桶。
- `summary.ts` / `render.ts` / `classify` **零 import**（自包含），Deno 与 Vitest 共用。
- 不在日志/返回/SQL 文件里出现任何密钥；`CRON_SECRET` 走 Supabase Vault，不硬编码进 migration。
- 测试命令：`pnpm --dir web test`（vitest run）。所有 `.test.ts` 均须本地真跑通过。
- 提交策略：按用户全局规则，**不自动 git commit**；每个 Task 末尾的"checkpoint"仅表示阶段完成，落工作区，提交权归用户。

---

## 文件结构

**新建：**
- `web/supabase/functions/weekly-report/summary.ts` — 零依赖聚合：`buildWeeklySummary()` + `decideAction()` + tz 日历工具
- `web/supabase/functions/weekly-report/render.ts` — 零依赖：`renderEmail(summary, opts)` → `{subject, html, text}`
- `web/supabase/functions/weekly-report/index.ts` — Deno handler（触发校验、拉数、发信、记日志）
- `web/supabase/functions/weekly-report/__tests__/summary.test.ts` — 平价 + tz 分桶 + 边界 + decideAction
- `web/supabase/functions/weekly-report/__tests__/render.test.ts` — 渲染断言 + 快照
- `web/supabase/functions/weekly-report/README.md` — 部署 / 密钥 / 手动触发自测
- `web/supabase/migrations/0002_weekly_report.sql` — `report_log` 表 + `weekly_report_enabled` 列 + pg_cron/pg_net

**修改：**
- `web/src/data/repository.ts` — `RewardRepo` 接口加 `getWeeklyReportEnabled()` / `setWeeklyReportEnabled()`
- `web/src/data/localRepo.ts` — 本地实现（localStorage）
- `web/src/data/supabaseRepo.ts` — 云端实现（`families.weekly_report_enabled` 列，仿 PIN）
- `web/src/data/__tests__/localRepo.test.ts` — 开关读写测试
- `web/src/ui/parent/pages.tsx` — `ParentSettings` 加"通知"区一个开关行
- `web/src/i18n/strings.ts` — 新增文案
- `web/tsconfig.app.json` — `exclude` 加 `supabase/functions`（Deno 文件不进 app build）
- `SETUP.md` — 部署章节

---

## Task 1: `summary.ts` — 零依赖聚合与判定

**Files:**
- Create: `web/supabase/functions/weekly-report/summary.ts`
- Test: `web/supabase/functions/weekly-report/__tests__/summary.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Cat = 'learning' | 'life' | 'character' | 'other'
  interface EvIn { points: number; category: Cat; ts: string; isVoided: boolean; ruleName: string; note: string | null }
  interface RedIn { cost: number; status: 'pending' | 'approved' | 'rejected'; decidedAt: string | null }
  interface ChildIn { id: string; name: string; avatarSymbol: string }
  interface WeeklySummary {
    child: ChildIn
    weekStartDate: string; weekEndDate: string        // 'YYYY-MM-DD' 上周一 / 上周日（含端）
    hasAnyHistory: boolean
    weekHasActivity: boolean
    weekNet: number; prevWeekNet: number; netDelta: number
    balance: number
    byCategory: Record<Cat, number>
    dailyTrend: { date: string; net: number }[]       // 7 项，最旧在前
    streak: number
    newBadges: { id: string; title: string; detail: string }[]
    approvedThisWeek: { rewardName: string; cost: number }[]
    pendingCount: number
    topPositive: { ruleName: string; count: number; total: number }[]
    penalties: { ruleName: string; points: number; note: string | null }[]
  }
  function buildWeeklySummary(a: { child: ChildIn; events: EvIn[]; redemptions: RedIn[]; tz: string; now: Date }): WeeklySummary
  type Action = 'send' | 'nudge' | 'skip_empty' | 'skip_disabled' | 'skip_already'
  function decideAction(a: { enabled: boolean; alreadySent: boolean; hasAnyHistory: boolean; weekHasActivity: boolean }): Action
  ```

**实现要点（写进代码注释）：**
- 分桶全部按 `tz` 的**墙上日期**（`wallDate(instant, tz)` 用 `Intl.DateTimeFormat('en-CA',{timeZone,tz})` 取 `YYYY-MM-DD`），不依赖运行时时区。
- 日历步进用纯 UTC `Date` 当计算器：`isoAddDays(iso,n)`、`isoWeekday(iso)`（1=周一..7=周日）。
- `thisMonday = 从 wallDate(now,tz) 回退到本周一`；报告周 `weekStartDate = isoAddDays(thisMonday,-7)`，`weekEndDate = isoAddDays(thisMonday,-1)`；7 个目标墙上日期 = `[weekStartDate .. weekEndDate]`。
- `weekNet`/`byCategory`/`dailyTrend` 仅计 `!isVoided` 且 `wallDate(ts) ∈ 目标 7 天` 的事件；`prevWeekNet` 取再前 7 天。
- `balance` = Σ(!voided points) − Σ(status==='approved' cost)（全时，与 `scoringEngine.balance` 同）。
- `streak` = 从 `weekEndDate`（上周日）起，用 `net-by-wallDate` map 连续 `net>0` 天数（该天 ≤0 或缺即断）。
- `newBadges` = 期末徽章集 − 期初徽章集（按 id）：里程碑用 `cumulativeEarned`（!voided 且 points>0，`wallDate(ts) < weekEndDate+1` vs `< weekStartDate`）；连击用 `streak` 期末 vs 期初（期初 streak 截至 `weekStartDate-1`=上上周日）。阈值同 badgeEngine。
- `approvedThisWeek` = `status==='approved'` 且 `wallDate(decidedAt) ∈ 目标 7 天`；`pendingCount` = 当前 `status==='pending'` 总数。
- `topPositive` = 本周 `points>0` 事件按 `ruleName` 聚合 `{count, total}`，`total` 降序取前 3；`penalties` = 本周 `points<0` 事件（原样列出，含 note）。
- `hasAnyHistory` = 存在任一 `!voided` 事件；`weekHasActivity` = 本周有任一 `!voided` 事件。
- `decideAction`：`!enabled→skip_disabled`；`alreadySent→skip_already`；`!hasAnyHistory→skip_empty`；`weekHasActivity→send`；否则 `nudge`。

- [ ] **Step 1: 写失败测试**（平价 + tz 分桶 + 边界 + decideAction）

```ts
// web/supabase/functions/weekly-report/__tests__/summary.test.ts
// tz-无关量对齐权威引擎；tz 敏感量用显式 Asia/Shanghai 期望；两者都与机器时区无关。
import { describe, it, expect } from 'vitest'
import { buildWeeklySummary, decideAction } from '../summary'
import { balance as domainBalance, netPoints, cumulativeEarned } from '../../../../src/domain/scoringEngine'
import type { ScoreEvent, RedemptionRequest } from '../../../../src/domain/types'

// 用 UTC 瞬时构造，tz='UTC' 时 summary 的墙上日期==UTC 日历日，可与 instant 型权威函数对齐。
const U = (y: number, m: number, day: number, h = 12) => new Date(Date.UTC(y, m - 1, day, h)).toISOString()
const ev = (points: number, tsISO: string, o: Partial<{ category: any; isVoided: boolean; ruleName: string; note: string | null }> = {}) =>
  ({ points, category: o.category ?? 'learning', ts: tsISO, isVoided: o.isVoided ?? false, ruleName: o.ruleName ?? 'rule', note: o.note ?? null })
const child = { id: 'c1', name: '小明', avatarSymbol: 'teddybear.fill' }
const NOW = new Date(Date.UTC(2026, 6, 6, 0)) // 2026-07-06 是周一（UTC）→ 报告周 = 06-29..07-05

function toDomainEvents(evs: ReturnType<typeof ev>[]): ScoreEvent[] {
  return evs.map((e, i) => ({ id: String(i), ruleID: null, ruleName: e.ruleName, category: e.category, points: e.points, note: e.note, timestamp: new Date(e.ts), childID: 'c1', isVoided: e.isVoided }))
}

describe('buildWeeklySummary parity (tz=UTC, instant-based)', () => {
  const events = [ev(10, U(2026, 6, 30)), ev(-5, U(2026, 7, 1)), ev(8, U(2026, 7, 3)), ev(6, U(2026, 6, 22)) /*上上周*/, ev(99, U(2026, 6, 30), { isVoided: true })]
  const redemptions: RedIn_local[] = [{ cost: 20, status: 'approved', decidedAt: U(2026, 7, 2) }, { cost: 5, status: 'pending', decidedAt: null }]
  type RedIn_local = { cost: number; status: 'pending' | 'approved' | 'rejected'; decidedAt: string | null }
  const s = buildWeeklySummary({ child, events, redemptions, tz: 'UTC', now: NOW })

  it('weekNet == netPoints over [Mon,next Mon) UTC', () => {
    const interval = { start: new Date(Date.UTC(2026, 5, 29)), end: new Date(Date.UTC(2026, 6, 6)) }
    expect(s.weekNet).toBe(netPoints(toDomainEvents(events), interval))
  })
  it('balance == domain balance', () => {
    const reds: RedemptionRequest[] = redemptions.map((r, i) => ({ id: String(i), rewardID: null, rewardName: 'r', cost: r.cost, status: r.status, requestedAt: new Date(), decidedAt: r.decidedAt ? new Date(r.decidedAt) : null, childID: 'c1' }))
    expect(s.balance).toBe(domainBalance(toDomainEvents(events), reds))
  })
  it('window & voided excluded: weekNet = 10-5+8 = 13', () => { expect(s.weekNet).toBe(13) })
  it('weekStartDate/weekEndDate = 上周一/上周日', () => { expect(s.weekStartDate).toBe('2026-06-29'); expect(s.weekEndDate).toBe('2026-07-05') })
  it('pendingCount & approvedThisWeek', () => { expect(s.pendingCount).toBe(1); expect(s.approvedThisWeek).toEqual([{ rewardName: 'r', cost: 20 }].map(() => ({ rewardName: undefined as any, cost: 20 }))?.map(() => ({ rewardName: 'reward', cost: 20 })) ?? []) })
})

describe('tz bucketing (Asia/Shanghai, machine-tz-independent)', () => {
  // 2026-06-29 23:00Z = 2026-06-30 07:00 (UTC+8) → 归入 06-30 桶
  const events = [ev(5, '2026-06-29T23:00:00.000Z', { ruleName: 'A' }), ev(7, '2026-06-30T02:00:00.000Z', { ruleName: 'A' })]
  const s = buildWeeklySummary({ child, events, redemptions: [], tz: 'Asia/Shanghai', now: NOW })
  it('都落在 06-30 当天', () => {
    const d30 = s.dailyTrend.find((x) => x.date === '2026-06-30')
    expect(d30?.net).toBe(12)
  })
})

describe('decideAction', () => {
  it('disabled', () => expect(decideAction({ enabled: false, alreadySent: false, hasAnyHistory: true, weekHasActivity: true })).toBe('skip_disabled'))
  it('already', () => expect(decideAction({ enabled: true, alreadySent: true, hasAnyHistory: true, weekHasActivity: true })).toBe('skip_already'))
  it('empty', () => expect(decideAction({ enabled: true, alreadySent: false, hasAnyHistory: false, weekHasActivity: false })).toBe('skip_empty'))
  it('nudge', () => expect(decideAction({ enabled: true, alreadySent: false, hasAnyHistory: true, weekHasActivity: false })).toBe('nudge'))
  it('send', () => expect(decideAction({ enabled: true, alreadySent: false, hasAnyHistory: true, weekHasActivity: true })).toBe('send'))
})
```

> 注：上面 `approvedThisWeek` 断言在实现时以真实字段（`rewardName`）简化为 `expect(s.approvedThisWeek).toEqual([{ rewardName: 'r', cost: 20 }])`；此处占位表达式在 Step 3 落地时替换为该干净断言。

- [ ] **Step 2: 运行测试确认失败** — `pnpm --dir web test summary` → FAIL（模块不存在）
- [ ] **Step 3: 实现 `summary.ts`**（按上面"实现要点"；零 import）
- [ ] **Step 4: 运行测试确认通过** — `pnpm --dir web test summary` → PASS
- [ ] **Step 5: checkpoint（不提交）**

---

## Task 2: `render.ts` — 邮件渲染

**Files:**
- Create: `web/supabase/functions/weekly-report/render.ts`
- Test: `web/supabase/functions/weekly-report/__tests__/render.test.ts`

**Interfaces:**
- Consumes: `WeeklySummary`（Task 1）
- Produces: `renderEmail(summary: WeeklySummary, opts: { appUrl: string; mode: 'report' | 'nudge' }): { subject: string; html: string; text: string }`

**要点：** 内联样式；7 天趋势用 `<table>`/`<div>` 画条（高度按 `net` 归一）；**无远程图片/外链 JS/CSS**；`text` 为纯文本兜底；主题含孩子名与周期；`report` 与 `nudge` 两模板。

- [ ] **Step 1: 写失败测试**

```ts
// web/supabase/functions/weekly-report/__tests__/render.test.ts
import { describe, it, expect } from 'vitest'
import { renderEmail } from '../render'
import type { WeeklySummary } from '../summary'

const base: WeeklySummary = {
  child: { id: 'c1', name: '小明', avatarSymbol: 'teddybear.fill' },
  weekStartDate: '2026-06-29', weekEndDate: '2026-07-05',
  hasAnyHistory: true, weekHasActivity: true,
  weekNet: 13, prevWeekNet: 5, netDelta: 8, balance: 74,
  byCategory: { learning: 18, life: 0, character: 0, other: -5 },
  dailyTrend: [{ date: '2026-06-29', net: 0 }, { date: '2026-06-30', net: 10 }, { date: '2026-07-01', net: -5 }, { date: '2026-07-02', net: 0 }, { date: '2026-07-03', net: 8 }, { date: '2026-07-04', net: 0 }, { date: '2026-07-05', net: 0 }],
  streak: 2,
  newBadges: [{ id: 'milestone_50', title: '起步星', detail: '累计获得 50 分' }],
  approvedThisWeek: [{ rewardName: '看30分钟电视', cost: 20 }],
  pendingCount: 1,
  topPositive: [{ ruleName: '认真完成作业', count: 1, total: 10 }],
  penalties: [{ ruleName: '拖延磨蹭', points: -5, note: '早上赖床' }],
}

describe('renderEmail report', () => {
  const r = renderEmail(base, { appUrl: 'https://app.example', mode: 'report' })
  it('主题含孩子名与周期', () => { expect(r.subject).toContain('小明'); expect(r.subject).toContain('06') })
  it('正文含关键数字与行动提醒', () => { expect(r.html).toContain('13'); expect(r.html).toContain('待你审批'); expect(r.html).toContain('起步星') })
  it('无远程资源', () => { expect(r.html).not.toMatch(/src="https?:/); expect(r.html).not.toMatch(/<script/i) })
  it('含打开 App 链接与退订说明', () => { expect(r.html).toContain('https://app.example'); expect(r.html).toContain('关闭') })
  it('text 兜底非空', () => { expect(r.text.length).toBeGreaterThan(10) })
})

describe('renderEmail nudge', () => {
  const r = renderEmail({ ...base, weekHasActivity: false }, { appUrl: 'https://app.example', mode: 'nudge' })
  it('nudge 主题是提醒口吻', () => { expect(r.subject).toContain('小明') })
  it('nudge 正文引导记分', () => { expect(r.html).toContain('记分') })
})
```

- [ ] **Step 2: 运行确认失败** — `pnpm --dir web test render` → FAIL
- [ ] **Step 3: 实现 `render.ts`**
- [ ] **Step 4: 运行确认通过** — `pnpm --dir web test render` → PASS
- [ ] **Step 5: checkpoint（不提交）**

---

## Task 3: 周报开关 — 仓库接口与两实现

**Files:**
- Modify: `web/src/data/repository.ts`（`RewardRepo` 尾部加两方法）
- Modify: `web/src/data/localRepo.ts`
- Modify: `web/src/data/supabaseRepo.ts`
- Test: `web/src/data/__tests__/localRepo.test.ts`

**Interfaces:**
- Produces（加入 `RewardRepo`）：`getWeeklyReportEnabled(): boolean` / `setWeeklyReportEnabled(enabled: boolean): Promise<void>`

**localRepo：** 仿 PIN——`const WEEKLY_KEY = 'reward-stars-weekly-report-v1'`；`getWeeklyReportEnabled()` = `storage.getItem(WEEKLY_KEY) !== 'off'`（默认开）；`setWeeklyReportEnabled(v)` 写 `'on'|'off'`，换 `this.snap = { ...this.snap }` 并 notify。

**supabaseRepo：** 仿 PIN——加 `private weeklyReportEnabled = true`；`refetch` 里 `select('pin_blob')` 改 `select('pin_blob, weekly_report_enabled')`，`this.weeklyReportEnabled = family.data?.weekly_report_enabled ?? true`；`getWeeklyReportEnabled()` 返字段；`setWeeklyReportEnabled(v)` `upsert({ id, weekly_report_enabled: v }, { onConflict: 'id' })` 后更新本地 + `this.snap={...this.snap}` + notify。

- [ ] **Step 1: 写失败测试**（localRepo）

```ts
// 追加到 web/src/data/__tests__/localRepo.test.ts
import { describe, it, expect } from 'vitest'
import { LocalRepo } from '../localRepo'

function mkStorage(): Storage {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as unknown as Storage
}

describe('weekly report toggle (local)', () => {
  it('默认开启', () => { expect(new LocalRepo(mkStorage()).getWeeklyReportEnabled()).toBe(true) })
  it('可关闭并读回', async () => { const r = new LocalRepo(mkStorage()); await r.setWeeklyReportEnabled(false); expect(r.getWeeklyReportEnabled()).toBe(false) })
  it('关闭后重开', async () => { const r = new LocalRepo(mkStorage()); await r.setWeeklyReportEnabled(false); await r.setWeeklyReportEnabled(true); expect(r.getWeeklyReportEnabled()).toBe(true) })
})
```

- [ ] **Step 2: 运行确认失败** — `pnpm --dir web test localRepo` → FAIL
- [ ] **Step 3: 实现** `repository.ts` 接口 + `localRepo` + `supabaseRepo`（后者随现有 PIN 范式，类型自洽即可）
- [ ] **Step 4: 运行确认通过** — `pnpm --dir web test localRepo` → PASS，且 `pnpm --dir web test` 全绿
- [ ] **Step 5: checkpoint（不提交）**

---

## Task 4: 家长设置开关 UI + i18n

**Files:**
- Modify: `web/src/ui/parent/pages.tsx`（`ParentSettings` 内，"语言"区后加"通知"区）
- Modify: `web/src/i18n/strings.ts`

**要点：** 用本地 state 从 `repo.getWeeklyReportEnabled()` 初始化（`useEffect(open)` 同步），点按调用 `repo.setWeeklyReportEnabled(next)`；`mode==='local'` 时行内注明"本地模式不发送邮件"。开关样式复用 `row` 类 + 一个 on/off pill。

- [ ] **Step 1: 加 i18n 文案**（`EN` 字典追加）

```ts
// web/src/i18n/strings.ts 内 EN 追加
通知: 'Notifications',
每周积分周报邮件: 'Weekly points email',
本地模式不发送邮件: "Local mode won't send email",
开: 'On',
关: 'Off',
```

- [ ] **Step 2: 在 `ParentSettings` 加"通知"区**

```tsx
// 放在"语言"区 <div>…</div> 之后
{(() => {
  const [wk, setWk] = useState(true)
  useEffect(() => { if (open) setWk(repo.getWeeklyReportEnabled()) }, [open])
  return (
    <div>
      <h3 className="text-sm text-gray-400 mb-2">{t('通知')}</h3>
      <div className={`${row} flex items-center justify-between`}>
        <span>{t('每周积分周报邮件')}</span>
        <button
          onClick={async () => { const next = !wk; setWk(next); await repo.setWeeklyReportEnabled(next) }}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${wk ? 'bg-accent text-white' : 'bg-gray-200 text-gray-500'}`}
        >{wk ? t('开') : t('关')}</button>
      </div>
      {mode === 'local' && <p className="text-xs text-gray-400 mt-1 px-1">{t('本地模式不发送邮件')}</p>}
    </div>
  )
})()}
```
（若行内 IIFE-hook 触发 lint/规则告警，则改为提取顶层子组件 `WeeklyReportToggle`，语义相同。实现时以能通过 `pnpm --dir web build` 为准。）

- [ ] **Step 3: 验证** — `pnpm --dir web build`（tsc + vite）PASS；`pnpm --dir web lint` 无新错
- [ ] **Step 4: 浏览器验证** — preview 起 `web` dev，进家长设置，切换开关，读 console 无错（见"验证工作流"）
- [ ] **Step 5: checkpoint（不提交）**

---

## Task 5: 数据库迁移 `0002_weekly_report.sql`

**Files:**
- Create: `web/supabase/migrations/0002_weekly_report.sql`

**内容：**
```sql
-- Weekly report: 开关列 + 幂等日志表 + 定时触发（pg_cron + pg_net）
alter table families add column if not exists weekly_report_enabled boolean not null default true;

create table if not exists report_log (
  id bigint generated always as identity primary key,
  family_id uuid not null references families (id) on delete cascade,
  week_start date not null,
  status text not null,                    -- sent | nudged | skip_empty | skip_disabled | skip_already | failed
  detail text,
  sent_at timestamptz not null default now(),
  unique (family_id, week_start)
);
alter table report_log enable row level security;  -- 无 policy → 客户端一律拒绝；service_role 绕过

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 定时：UTC 周一 00:00 = UTC+8 周一 08:00。CRON_SECRET 从 Vault 读，勿硬编码。
-- 部署前置：Dashboard→Settings→Vault 存 project_url / anon_key / cron_secret（见 README）。
select cron.schedule(
  'weekly-report',
  '0 0 * * 1',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```
> 无法本地单测（需 Supabase 实例）。正确性靠部署后手动触发验证（README）。SQL 里**不含任何明文密钥**。

- [ ] **Step 1: 写 SQL 文件**（上面内容）
- [ ] **Step 2: 静态检查** — 通读确认无明文密钥、`if not exists` 幂等、状态字符串与 `summary.ts`/`index.ts` 一致
- [ ] **Step 3: checkpoint（不提交）**

---

## Task 6: Edge Function `index.ts`（Deno handler）

**Files:**
- Create: `web/supabase/functions/weekly-report/index.ts`
- Modify: `web/tsconfig.app.json`（`exclude` 加 `"supabase/functions"`，避免 Deno 语法进 app 的 tsc build）

**Interfaces:**
- Consumes: `buildWeeklySummary` / `decideAction`（`./summary.ts`）、`renderEmail`（`./render.ts`）

**流程（写进代码）：**
1. `Deno.serve`：校验 `req.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET')`，否则 `401`。
2. 建 admin client：`createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`（`esm.sh/@supabase/supabase-js@2`）。
3. `tz = Deno.env.get('REPORT_TZ') ?? 'Asia/Shanghai'`；`now = new Date()`；先算 `weekStartDate`（用 `buildWeeklySummary` 同款工具或临时 child 空数据取 `weekStartDate`）。
4. `admin.auth.admin.listUsers()` 分页 → `Map<familyId, email>`（跳过无 email）。
5. 逐家：读 `families.weekly_report_enabled`；查 `report_log`（family_id, week_start）是否已 sent/nudged；拉 `children`（取第一个）、`events`、`redemptions`（service_role，按 family_id）。
6. `buildWeeklySummary(...)` → `decideAction(...)`。`send`/`nudge` → `renderEmail` → Resend `POST https://api.resend.com/emails`（`Authorization: Bearer RESEND_API_KEY`，from=`REPORT_FROM`，to=email）。
7. `upsert report_log`（onConflict `family_id,week_start`）记状态；单家异常 try/catch 记 `failed` 并继续。
8. 返回 `{ weekStart, sent, nudged, skip_empty, skip_disabled, skip_already, failed }`（计数）。
9. 日志只 `console.log` family_id + status，**不打印邮件正文/密钥**。

- [ ] **Step 1: 写 `index.ts`**（按流程；Deno 风格 import 用 `.ts` 后缀引 `./summary.ts` `./render.ts`）
- [ ] **Step 2: `tsconfig.app.json` 加 exclude**，确认 `pnpm --dir web build` 仍 PASS（app build 不触碰 Deno 文件）
- [ ] **Step 3: `pnpm --dir web test` 全绿**（index 不被测试引入，纯函数测试不受影响）
- [ ] **Step 4: checkpoint（不提交）**

---

## Task 7: 文档与部署 runbook

**Files:**
- Create: `web/supabase/functions/weekly-report/README.md`
- Modify: `SETUP.md`（加"每周周报邮件"小节，指向上面 README）

**README 覆盖：** 前置（Resend 账号 + 发件域名/`onboarding@resend.dev`）；Vault 存 `project_url`/`anon_key`/`cron_secret`；`supabase secrets set RESEND_API_KEY / CRON_SECRET / REPORT_TZ / APP_URL / REPORT_FROM`；`supabase db push`；`supabase functions deploy weekly-report`；手动触发 `curl -X POST .../functions/v1/weekly-report -H "x-cron-secret: <CRON_SECRET>"`；预期返回计数 JSON；时区非 UTC+8 时改 cron 与 `REPORT_TZ`；规模增大时改批量聚合（避免 N+1）。

- [ ] **Step 1: 写 README + 更新 SETUP.md**
- [ ] **Step 2: 通读自检**（命令可直接复制执行、与 migration/函数环境变量名一致）
- [ ] **Step 3: checkpoint（不提交）**

---

## 收尾验证（交付前）

- [ ] `pnpm --dir web test` 全绿（含新增 summary / render / localRepo 测试 + 原有 58/所有测试）
- [ ] `pnpm --dir web build` PASS（tsc + vite，Deno 文件已 exclude）
- [ ] `pnpm --dir web lint` 无新增错误
- [ ] 浏览器：家长设置开关可切换、无 console 错
- [ ] 汇总"我已验证 / 需你部署"清单交付；**不自动提交**，附建议 commit 命令

---

## 自审：spec 覆盖

- §3 架构/§4 时区 → Task 1（周窗口/tz 分桶）+ Task 5（cron `0 0 * * 1`）+ Task 6（tz env）✓
- §5.1 summary / §5.2 render / §5.3 index / §5.4 平价测试 → Task 1/2/6 + Task 1&2 测试 ✓
- §5.5 migration（report_log/flag/cron） → Task 5 ✓
- §5.6 设置开关（接口+两实现+UI） → Task 3/4 ✓
- §6 幂等/部分失败/多租户 → Task 6（report_log 查重 + try/catch + listUsers 分页）✓
- §7 邮件内容 → Task 2 ✓
- §8 空档分流 → Task 1 `decideAction` ✓
- §9 安全（CRON_SECRET/Vault/无明文/日志纪律） → Task 5/6 ✓
- §10 测试可达性 → 收尾验证 + README 手动触发 ✓
- §11/§12 用户负责/部署 → Task 7 ✓
