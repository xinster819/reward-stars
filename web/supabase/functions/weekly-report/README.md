# weekly-report — 每周积分周报邮件

每周一早上（默认 UTC+8 08:00）自动给**每个家庭**的家长邮箱发一封「上一整周孩子积分周报」。

- 触发：`pg_cron`（周一 00:00 UTC）→ `pg_net` POST 本函数（迁移 `0002_weekly_report.sql`）
- 计算：`summary.ts`（零依赖纯函数，口径与 `web/src/domain/` 守恒，Vitest 平价测试保证）
- 渲染：`render.ts`（邮件安全 HTML + 纯文本兜底）
- 投递：Resend REST API
- 幂等：`report_log(family_id, week_start)` 唯一键，重跑不重复发信
- 分流：从未记分的空账号跳过；有历史但本周静默 → 轻量提醒；家长可在「家长设置 → 通知」关闭

## 报告周与时区

函数在周一早上运行，报告覆盖**刚结束的上一整周** `[上周一, 上周日]`，按 `REPORT_TZ` 的墙上日期分桶。
`pg_cron` 按 UTC：`0 0 * * 1`（周一 00:00 UTC）在 `Asia/Shanghai` 即周一 08:00。
**本地时区非 UTC+8 时**：同时改 `0002_weekly_report.sql` 的 cron 表达式与本函数的 `REPORT_TZ`。

## 环境变量（Edge Function secrets）

| 变量 | 说明 |
|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 平台自动注入，无需手动设 |
| `RESEND_API_KEY` | Resend API key |
| `CRON_SECRET` | 自定义随机串；函数校验 `x-cron-secret` 头，防公网乱触发 |
| `REPORT_TZ` | 报告时区，默认 `Asia/Shanghai` |
| `APP_URL` | App 部署地址（邮件里「打开 App」链接），如 Vercel 域名 |
| `REPORT_FROM` | 发件地址；测试用 `Reward Stars <onboarding@resend.dev>`，正式用你验证过的域名 |

## Vault（供 cron 触发时读取，勿写进 SQL 文件）

在 Dashboard → Project Settings → Vault 新增三条 secret：

| name | value |
|---|---|
| `project_url` | `https://<project-ref>.supabase.co` |
| `anon_key` | 项目 anon key |
| `cron_secret` | 与上面 `CRON_SECRET` **相同**的值 |

## 部署

```bash
# 1) 迁移：建 report_log、加 weekly_report_enabled 列、装 pg_cron/pg_net、排定时任务
supabase db push          # 或在 Dashboard SQL Editor 执行 0002_weekly_report.sql

# 2) 设 Edge Function secrets
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  CRON_SECRET=$(openssl rand -hex 24) \
  REPORT_TZ=Asia/Shanghai \
  APP_URL=https://your-app.vercel.app \
  REPORT_FROM="Reward Stars <onboarding@resend.dev>"
# 注意：把上面生成的 CRON_SECRET 同值写入 Vault 的 cron_secret

# 3) 部署函数
supabase functions deploy weekly-report
```

## 手动触发自测（不必等到周一）

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/weekly-report" \
  -H "x-cron-secret: <你的 CRON_SECRET>"
```

预期返回计数 JSON：

```json
{ "weekStart": "2026-07-06", "sent": 1, "nudged": 0, "skip_empty": 0, "skip_disabled": 0, "skip_already": 0, "failed": 0 }
```

- 想再次真发：先删掉本周日志再触发 —— `delete from report_log where week_start = '<weekStart>';`
- 查看结果：`select * from report_log order by sent_at desc;`

## 本地单元测试（口径 + 渲染，无需 Supabase）

```bash
pnpm --dir web test summary   # 平价（对 web/src/domain）+ tz 分桶 + decideAction
pnpm --dir web test render    # 邮件渲染断言 + 安全性
```

## 规模化提醒

当前逐家查询（N+1），家庭数很小时可接受。家庭规模变大后，应改为按 `week_start` 窗口一次性批量聚合，
减少每家往返。`report_log` 的 `week_start` 索引已备好。
