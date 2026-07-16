# 每周积分周报邮件服务 — 设计稿

- **日期**：2026-07-16
- **状态**：设计已与用户确认，待写实现计划
- **归属**：`web/`（React + Supabase 主线）；iOS 原生版冻结，不改动
- **一句话**：每周一早上给每个家庭的家长自动发一封"上一整周孩子积分周报"邮件

---

## 1. 背景与目标

`RewardingSystem` 是家庭孩子行为奖惩 App。Web 版数据在 Supabase：一个家庭 = 一个 `auth` 账号，
`families.id = auth.users.id`，业务行（events/redemptions/…）按 `family_id` + RLS 隔离。

积分统计逻辑已作为**纯函数**存在于 `web/src/domain/`（`scoringEngine.ts` / `streakCalculator.ts` /
`badgeEngine.ts`），并有 `__tests__` 覆盖。本功能**不新造计分逻辑**，只新增：**定时触发 + 每家聚合 +
邮件渲染 + 投递 + 幂等记录 + 家长退订开关**。

**目标**：无需任何人打开 App，每周一早上家长邮箱自动收到上一整周的孩子积分周报。

---

## 2. 已确认决策

| 项 | 选择 |
|---|---|
| 投递渠道 | 家长周报**邮件** |
| 邮件服务 | **Resend** |
| 收件范围 | **所有注册家庭各发各的**（多租户，遍历 `auth.users`） |
| 发送时机 | **周一 08:00 本地时区**（默认 UTC+8） |
| 统计位置 | **方案 A**：Edge Function 内用零依赖 TS 模块 `summary.ts` 聚合，Vitest 平价测试钉死在权威引擎上 |
| 空档周 | **从未记分的空账号跳过**；**有历史但本周静默 → 发轻量提醒变体** |
| 退订 | 纳入范围：`families.weekly_report_enabled` 开关列 + 家长设置里的开关 UI |

---

## 3. 架构与数据流

```
pg_cron 定时（UTC 周一 00:00 = UTC+8 周一 08:00，表达式 0 0 * * 1）
  └─ pg_net.http_post → Edge Function「weekly-report」(Header: x-cron-secret)
       1. 校验 x-cron-secret == CRON_SECRET（否则 401；防公网乱触发）
       2. 用 SERVICE_ROLE 建 admin client
       3. auth.admin.listUsers()（分页）→ 每个 family_id ↦ parent email
       4. 逐家：
          a. 读 families.weekly_report_enabled；false → 跳过（记 skipped_disabled）
          b. 查 report_log 是否已发过本周（week_start 唯一）→ 已发则跳过（幂等）
          c. service_role 拉该家 children + 上一整周窗口相关 events/redemptions
          d. summary.ts 计算周报数据
          e. 分流：从未记分空账号 → 跳过(skipped_empty)；本周静默但有历史 → nudge 变体
          f. render.ts → {subject, html, text}
          g. Resend 发送
          h. upsert report_log(family_id, week_start, status, detail, sent_at)
       5. 返回汇总 JSON：{ sent, skipped_disabled, skipped_empty, nudged, failed, weekStart }
```

**触发链**：pg_cron（定时）→ pg_net（HTTP）→ Edge Function（逻辑）。三者都写进 migration，版本可控，
与项目"一切进 migration"的约定一致。

---

## 4. 时区与"上一整周"的正确性（易错点）

- 计分周**周一起算**（`weekInterval(now, firstWeekday=1)`）。
- 函数在**周一早上**运行，报告必须覆盖**刚结束的上一整周**，而不是刚开始的本周：
  - `thisWeekStart = 本地时区本周一 00:00`
  - **报告窗口 = `[thisWeekStart − 7天, thisWeekStart)`**，即上周一 00:00 到本周一 00:00（含头不含尾）
  - `week_start`（幂等键）= 该窗口起始日（上周一，`date` 类型）
- **所有按天/按周分桶都在目标时区内完成**。Edge Function 运行在 Deno（UTC），故 `summary.ts` 必须接收
  `tz` 参数，用 `Intl.DateTimeFormat({ timeZone: tz })` 取本地年月日来分桶，**不得依赖运行时默认时区**。
- pg_cron 只跑 UTC：`0 0 * * 1`（UTC 周一 00:00）在 UTC+8 即周一 08:00。**若用户本地非 UTC+8，改 cron 表达式**。
- **待确认假设**：默认 `REPORT_TZ = Asia/Shanghai (UTC+8)`。用户如在别的时区需同时调整 cron 与 `REPORT_TZ`。

---

## 5. 组件与接口

所有新增文件在 `web/` 下；iOS 目录不动。

### 5.1 `web/supabase/functions/weekly-report/summary.ts`（零依赖纯函数，Deno + Vitest 共用）

**约束**：无任何 import（自包含），只用 `Date` / `Intl` / 内置。这样 Deno 直接引、Vitest 也直接引。

**输入**（由 index.ts 从 DB 行映射为规范化形状；用 ISO 字符串避免 Date 序列化歧义）：
```ts
type Cat = 'learning' | 'life' | 'character' | 'other'
interface EvIn { points: number; category: Cat; ts: string; isVoided: boolean; ruleName: string; note: string | null }
interface RedIn { cost: number; status: 'pending' | 'approved' | 'rejected'; decidedAt: string | null }
interface ChildIn { id: string; name: string; avatarSymbol: string }
interface BuildArgs { child: ChildIn; events: EvIn[]; redemptions: RedIn[]; tz: string; now: Date }
```
**输出**：
```ts
interface WeeklySummary {
  child: ChildIn
  weekStartISO: string; weekEndISO: string          // [start, end)
  hasAnyHistory: boolean                            // 该孩子是否曾有任一非 voided 事件
  weekNet: number; prevWeekNet: number; netDelta: number   // 本周净分、上周净分、差值
  balance: number                                  // 全时余额 = Σ非voided − Σapproved花费
  byCategory: Record<Cat, number>                  // 本周各分类净分
  dailyTrend: { dateISO: string; net: number }[]   // 7 天，本地分桶，最旧在前
  streak: number                                   // 截至上周日(周窗口最后一天)的连击天数
  newBadges: { id: string; title: string; detail: string }[]  // 本周新解锁徽章
  approvedThisWeek: { rewardName: string; cost: number }[]     // 本周已兑换
  pendingCount: number                             // 当前待审批总数（行动提醒）
  topPositive: { ruleName: string; count: number; total: number }[]  // 本周最多的正向行为(前3)
  penalties: { ruleName: string; points: number; note: string | null }[]  // 本周扣分事项
}
```
**计算语义（必须与 `web/src/domain/` 权威一致，平价测试守恒）**：
- `balance` = Σ(非 voided 事件 points) − Σ(approved 兑换 cost)（全时）
- `weekNet` = Σ(非 voided 且 ts ∈ [weekStart,weekEnd) 的 points)；`prevWeekNet` 同法取前一周
- `byCategory` = 本周非 voided 事件按 category 求净分
- `dailyTrend` = 周内 7 天，每天在 `tz` 内分桶求净分，无事件的天 net=0 占位
- `streak` = 从**上周日**往前数、连续每天净分 > 0 的天数（该天 ≤0 即断）
- `newBadges` = `badges(earnedAtEnd, streakAtEnd)` − `badges(earnedAtStart, streakAtStart)`（按 id 差集）
  - `earnedAtX` = cumulativeEarned（仅非 voided 且 points>0）在 ts < X 的累计
  - 里程碑阈值 50/100/200/500、连击阈值 3/7 —— **复刻 `badgeEngine.ts` 常量，平价测试对齐**
- `hasAnyHistory` = 存在任一非 voided 事件（用于"从未记分"判定）

### 5.2 `web/supabase/functions/weekly-report/render.ts`（纯函数）

`renderEmail(summary: WeeklySummary, opts): { subject: string; html: string; text: string }`
- `opts`：`{ appUrl: string; mode: 'report' | 'nudge' }`
- 邮件安全 HTML：内联样式、表格/div 画 7 天迷你条，无外链 JS/CSS/远程图片
- 同时产出纯文本兜底（text/plain）
- 内容见 §7

### 5.3 `web/supabase/functions/weekly-report/index.ts`（Deno handler）

- 依赖：`@supabase/supabase-js`（esm.sh）、Resend（`npm:resend` 或直接 `fetch` Resend REST）
- 环境变量：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（平台自带）、`RESEND_API_KEY`、`CRON_SECRET`、
  `REPORT_TZ`（默认 Asia/Shanghai）、`APP_URL`（Vercel 部署地址）、`REPORT_FROM`（发件地址）
- 流程见 §3；**部分失败不阻断**：单家失败记 `failed` 并继续下一家
- **绝不在日志/返回里打印** API key、service_role、家长邮箱明文之外的敏感信息（邮箱本身是投递必需，
  但日志里只记 family_id 与状态，不记邮件正文）

### 5.4 `web/supabase/functions/weekly-report/__tests__/summary.test.ts`（Vitest / Node）

- **平价测试**：构造 fixture 事件/兑换，分别喂给
  1. 权威引擎 `web/src/domain/scoringEngine.ts` / `streakCalculator.ts` / `badgeEngine.ts`
  2. 本模块 `summary.ts`
  断言 `weekNet` / `balance` / `dailyTrend` / `streak` / `newBadges` 完全一致。
  测试内 `process.env.TZ` 设为目标时区，使权威引擎的隐式本地分桶与 `summary.ts` 的显式 tz 分桶对齐。
- **边界用例**：空账号（hasAnyHistory=false）、本周静默但有历史、跨周边界事件（周一 00:00 属于本周非上周）、
  voided 事件被排除、扣分周（weekNet<0）。
- **render 快照**：report 与 nudge 两种变体各一张快照。

### 5.5 `web/supabase/migrations/0002_weekly_report.sql`

- `families` 加列：`weekly_report_enabled boolean not null default true`
- 建表 `report_log`：
  ```
  id bigint generated always as identity primary key
  family_id uuid not null references families(id) on delete cascade
  week_start date not null
  status text not null            -- sent | nudged | skipped_empty | skipped_disabled | failed
  detail text
  sent_at timestamptz not null default now()
  unique (family_id, week_start)   -- 幂等键
  ```
  （`report_log` 与其它表一致 `enable row level security` 但**不建任何 policy** → 客户端一律拒绝；
  service_role 本就绕过 RLS，服务端读写不受影响）
- 启用扩展 `pg_cron`、`pg_net`（Supabase 支持；`create extension if not exists`）
- 建 cron 任务：`cron.schedule('weekly-report', '0 0 * * 1', $$ select net.http_post(url, headers, body) $$)`
  - url = `https://<project-ref>.supabase.co/functions/v1/weekly-report`
  - headers 含 `x-cron-secret`（值从 Vault/`current_setting` 读，**不硬编码进 migration**——见 §9）

### 5.6 家长设置开关（`web/src/`）

- Repo 接口加 `getWeeklyReportEnabled(): boolean` / `setWeeklyReportEnabled(v: boolean): Promise<void>`
  - `supabaseRepo`：读写 `families.weekly_report_enabled`（随首拉一起 select）
  - `localRepo`：本地演示模式无云端邮件，开关存 localStorage 但仅占位（本地模式不发邮件，UI 灰显或注明）
- 家长设置页加一个开关行「每周积分周报邮件」，读写上面接口
- i18n 文案补充

### 5.7 文档

- 新增 `web/supabase/functions/weekly-report/README.md`：部署、密钥、手动触发自测命令
- 更新 `SETUP.md`：Resend 账号、Supabase secrets、`supabase functions deploy`、cron 说明

---

## 6. 幂等、错误处理、多租户

- **幂等**：`report_log` 的 `unique(family_id, week_start)`。函数处理每家前先查是否已 `sent/nudged`；是则跳过。
  这样 cron 重试或手动重跑不会重复发信。
- **部分失败**：逐家 try/catch，单家异常记 `failed` 继续；返回体给出各状态计数，便于观测。
- **多租户枚举**：`auth.admin.listUsers()` 分页（每页 up to 1000）。当前规模极小（≈1 家），N+1 逐家查询可接受；
  **在 README 注明**：家庭数增大时应改为按 `week_start` 窗口一次性批量聚合，避免逐家往返。
- **无邮箱/未确认邮箱**：`auth.users.email` 为空或未确认则跳过并记 `failed:no_email`。

---

## 7. 邮件内容规格

**主题**：`📊 {孩子名} 上周积分周报（6月30日–7月6日）`
（nudge 变体：`本周还没给 {孩子名} 记分哦～`）

**正文（report，每个孩子一段；MVP 一个孩子）**：
1. 周期标题 + 孩子名/头像占位
2. **本周净得分** `+42`，并列**较上周** `↑ 8` / `↓ 5`
3. **当前余额** `74 分`
4. **本周分类拆分**：学习 / 生活 / 品德 / 其他 各净分（小表格）
5. **7 天趋势**：迷你条形（div/表格，邮件安全），标注每天净分
6. **连击**：`🔥 连续 5 天正向得分`
7. **本周新解锁徽章**：若有，列出徽章名+说明；无则不显示该块
8. **本周兑换**：已兑换项列表 + `⏳ 有 N 笔待你审批`（pendingCount>0 时的行动提醒）
9. **亮点**：本周最高频正向行为前 3；若有扣分，列出扣分事项与备注
10. 页脚：`打开 App`（APP_URL 链接）+ `想关闭周报？家长设置里可关` 说明

**nudge 变体**：一句问候 + "本周还没有记录，别忘了给孩子记分~" + 打开 App 链接 + 关闭说明。

---

## 8. 空档周分流规则

- `hasAnyHistory == false`（该家从未记过任何分）→ **完全跳过**，记 `skipped_empty`，不发信。
- `hasAnyHistory == true` 且 `本周无任何非 voided 事件` → 发 **nudge 变体**，记 `nudged`。
- 其余 → 发 **report**，记 `sent`。
- `weekly_report_enabled == false` → 跳过，记 `skipped_disabled`。

---

## 9. 安全

- **触发保护**：Edge Function 校验 `x-cron-secret` 头等于 `CRON_SECRET`，不匹配 401。
- **CRON_SECRET 不入库明文**：migration 里 cron 任务的 header 值通过 Supabase Vault 或数据库设置读取
  （`select decrypted_secret from vault.decrypted_secrets where name='cron_secret'`），**不把密钥硬编码进
  SQL 文件**（该文件会进 git）。部署步骤里由用户把密钥写入 Vault 与 Edge Function secrets。
- **service_role 仅在 Edge Function 内使用**，绝不下发到前端。
- **日志纪律**：不打印 key/service_role/邮件正文；`report_log.detail` 只存状态类信息（如错误码），不存 PII 正文。
- 邮件 HTML 不含远程资源/脚本，降低被标垃圾邮件与注入风险。

---

## 10. 测试策略（诚实标注可达性）

| 层 | 能否本地真跑 | 方式 |
|---|---|---|
| `summary.ts` 平价 + 边界 | ✅ 我本地跑 | `pnpm --dir web test`（Vitest） |
| `render.ts` 快照 | ✅ 我本地跑 | Vitest 快照 |
| 设置开关读写 | ✅ 我本地跑 | 现有 repo 测试模式（localRepo 单测；supabaseRepo 逻辑走类型+既有测试范式） |
| Edge Function 端到端（真发信/定时） | ❌ 需用户 Resend key + Supabase 部署（真实边界） | 交付一条手动触发命令，由用户自测；结果我协助读日志排查 |

**完成铁律遵守**：本地能跑的测试我当场跑并贴命令+输出；发信/定时明确标注"未在本地验证，因需你的密钥与部署"。

---

## 11. 用户负责的部分（真实边界）

1. 注册 **Resend** 账号，拿 `RESEND_API_KEY`（测试可用 `onboarding@resend.dev` 发件；正式需验证发件域名并设 `REPORT_FROM`）
2. Supabase 设 secrets：`RESEND_API_KEY`、`CRON_SECRET`、`REPORT_TZ`、`APP_URL`、`REPORT_FROM`
   （`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 平台自带）；并把 `CRON_SECRET` 写入 Vault 供 cron 用
3. 本机装并 link **Supabase CLI**（部署 Edge Function 用；`supabase db push` 你们已在用）
4. 确认**本地时区**（默认 UTC+8 / cron `0 0 * * 1`；不同则告知，我改 cron 与 `REPORT_TZ`）

---

## 12. 部署步骤（写进 README/SETUP）

```bash
# 1) 迁移（建 report_log、加开关列、装 cron+pg_net、排定时任务）
supabase db push        # 或 Dashboard SQL Editor 执行 0002_weekly_report.sql

# 2) 设密钥
supabase secrets set RESEND_API_KEY=... CRON_SECRET=... REPORT_TZ=Asia/Shanghai APP_URL=https://... REPORT_FROM="Reward Stars <onboarding@resend.dev>"
# 并把 CRON_SECRET 存入 Vault（供 cron 的 http_post header 用）

# 3) 部署函数
supabase functions deploy weekly-report

# 4) 手动触发自测（不必等到周一）
curl -X POST "$SUPABASE_URL/functions/v1/weekly-report" -H "x-cron-secret: $CRON_SECRET"
# 预期返回 { sent, skipped_disabled, skipped_empty, nudged, failed, weekStart }
```

---

## 13. 不在本次范围（未来）

- 每家自定义时区/发送时间/收件人（当前全局 `REPORT_TZ`）
- 一键退订链接（当前用登录后设置页开关；给自己账号发信风险低）
- 多孩子横向对比、月报/季报、可视化图表图片（inline chart image）
- Web Push / 应用内通知（本次只做邮件）

---

## 14. 待确认假设一览

- 💭 本地时区 = **UTC+8**（cron `0 0 * * 1`）——用户未否认即按此
- 💭 发件地址正式域名未定，测试期用 `onboarding@resend.dev`
- ✅ 计分周周一起算、报告覆盖"上一整周"、统计语义对齐 `web/src/domain/`（平价测试守恒）
