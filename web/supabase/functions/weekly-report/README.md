# weekly-report — 每周积分周报邮件

每周一早上（默认 UTC+8 08:00）自动给**每个家庭**的家长邮箱发一封「上一整周孩子积分周报」。

- 触发：`pg_cron`（周一 00:00 UTC）→ `pg_net` POST 本函数（迁移 `0002_weekly_report.sql`）
- 计算：`summary.ts`（零依赖纯函数，口径与 `web/src/domain/` 守恒，Vitest 平价测试保证）
- 渲染：`render.ts`（邮件安全 HTML + 纯文本兜底）
- 投递：**Gmail SMTP**（`denomailer`）——用你自己的 Gmail 发，不依赖第三方发信服务
- 幂等：`report_log(family_id, week_start)` 唯一键，重跑不重复发信
- 分流：从未记分的空账号跳过；有历史但本周静默 → 轻量提醒；家长可在「家长设置 → 通知」关闭

## 报告周与时区

函数在周一早上运行，报告覆盖**刚结束的上一整周** `[上周一, 上周日]`，按 `REPORT_TZ` 的墙上日期分桶。
`pg_cron` 按 UTC：`0 0 * * 1`（周一 00:00 UTC）在 `Asia/Shanghai` 即周一 08:00。
**本地时区非 UTC+8 时**：同时改 `0002_weekly_report.sql` 的 cron 表达式与本函数的 `REPORT_TZ`。

## 前置：Gmail 应用专用密码（App Password）

用 Gmail SMTP 发信，需要一个 **App Password**（不是你的登录密码）：
1. Google 账号必须**已开启两步验证（2FA）**——否则没有 App Password 选项。
2. 打开 [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) → 生成一个（起个名如 "reward-stars"）→ 得到一串 **16 位密码**（形如 `abcd efgh ijkl mnop`，用时去掉空格）。
3. 这串就是下面的 `GMAIL_APP_PASSWORD`；`GMAIL_USER` 是你的 Gmail 地址。

> Gmail 免费额度约 500 封/天，家庭自用一周一封绰绰有余。发件人显示为你这个 Gmail 地址。

## 环境变量（Edge Function secrets）

| 变量 | 说明 |
|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 平台自动注入，无需手动设 |
| `GMAIL_USER` | 发件 Gmail 地址（同时是 SMTP 认证用户名） |
| `GMAIL_APP_PASSWORD` | 上面生成的 16 位应用专用密码（去掉空格） |
| `SMTP_HOST` / `SMTP_PORT` | 默认 `smtp.gmail.com` / `465`，一般不用改 |
| `CRON_SECRET` | 自定义随机串；函数校验 `x-cron-secret` 头，防公网乱触发 |
| `REPORT_TZ` | 报告时区，默认 `Asia/Shanghai` |
| `APP_URL` | App 部署地址（邮件里「打开 App」链接），如 Vercel 域名 |
| `REPORT_FROM` | 发件显示名/地址，默认 `行为奖励 Reward Stars <GMAIL_USER>`；地址须等于 `GMAIL_USER`（或已在 Gmail 设置的 send-as 别名） |

## Vault（供 cron 触发时读取，勿写进 SQL 文件）

在 Dashboard → **Integrations → Vault → Secrets** 新增**两条**：

| name | value |
|---|---|
| `project_url` | `https://<project-ref>.supabase.co` |
| `cron_secret` | 与 Edge Function secrets 里的 `CRON_SECRET` **完全相同**的值 |

> ⚠️ 两处 `cron_secret` 不一致 = 定时那次直接 401、收不到邮件（手动 curl 却是好的，很难察觉）。
> 改密钥时**务必两边同步**。
>
> 不需要 `anon_key`：函数以 `--no-verify-jwt` 部署，平台不再校验 Authorization 头。
> 安全性不降级——真正把关的是 `x-cron-secret`；anon key 本就是公开的（打包进前端 JS），那道门形同虚设。

## 部署

```bash
# 1) 迁移：建 report_log、加 weekly_report_enabled 列、装 pg_cron/pg_net、排定时任务
supabase db push          # 或在 Dashboard SQL Editor 执行 0002_weekly_report.sql

# 2) 设 Edge Function secrets
supabase secrets set \
  GMAIL_USER=you@gmail.com \
  GMAIL_APP_PASSWORD=abcdefghijklmnop \
  CRON_SECRET=$(openssl rand -hex 24) \
  REPORT_TZ=Asia/Shanghai \
  APP_URL=https://reward-stars.vercel.app
# 注意：把上面生成的 CRON_SECRET 同值写入 Vault 的 cron_secret

# 3) 部署函数（必须带 --no-verify-jwt：让 cron 无需 anon_key；安全由 x-cron-secret 把关）
supabase functions deploy weekly-report --project-ref <project-ref> --no-verify-jwt
```

> ⚠️ 边缘运行时出站 SMTP：Supabase Edge Function（Deno）支持 `denomailer` 出站发信，
> 但极少数情况下平台可能限制 465/587 出站端口。**首次手动触发若返回 `failed` 且 detail 为 `smtp_...`**，
> 多半是端口/认证问题——把 detail 发我，必要时改 `SMTP_PORT=587` 或退回 API 型发信服务。

## 手动触发自测（不必等到周一）

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/weekly-report" \
  -H "x-cron-secret: <你的 CRON_SECRET>"
```

预期返回计数 JSON：

```json
{ "weekStart": "2026-07-06", "sent": 1, "nudged": 0, "skip_empty": 0, "skip_disabled": 0, "skip_already": 0, "failed": 0 }
```

- **想强制重发**（忽略幂等，自测用）：URL 加 `?force=1`
  ```bash
  curl -X POST ".../functions/v1/weekly-report?force=1" -H "x-cron-secret: <CRON_SECRET>"
  ```
- 查看结果：`select * from report_log order by sent_at desc;`

## 验证定时链路（不必等到周一）

Dashboard → **Integrations → Cron → Jobs**：
- `Next run` 应显示本地时间的**周一 08:00**（例：`20 Jul 2026 08:00:00 (+0800)`）——这是时区是否配对的最直接证据
- 行尾 `⋯` → **Run command** 可立即执行该 cron 的真实命令（走 Vault → pg_net → 函数全链路）
- 结果查 `select id, status_code, content from net._http_response order by id desc limit 5;`
  （200 = 通；401 = 两处 `cron_secret` 不一致）

## 本地单元测试（口径 + 渲染，无需 Supabase）

```bash
pnpm --dir web test summary   # 平价（对 web/src/domain）+ tz 分桶 + decideAction
pnpm --dir web test render    # 邮件渲染断言 + 安全性
```

## 规模化提醒

当前逐家查询（N+1），家庭数很小时可接受。家庭规模变大后，应改为按 `week_start` 窗口一次性批量聚合，
减少每家往返。`report_log` 的 `week_start` 索引已备好。
