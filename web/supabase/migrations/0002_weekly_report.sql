-- 每周积分周报邮件：家庭级开关列 + 幂等日志表 + 定时触发（pg_cron + pg_net）。
-- 对位 docs/superpowers/specs/2026-07-16-weekly-points-email-design.md。
-- ⚠️ 本文件不含任何明文密钥；cron 触发所需的 URL/anon_key/cron_secret 从 Supabase Vault 读取
--    （部署前置：Dashboard → Project Settings → Vault 存 project_url / anon_key / cron_secret，见函数 README）。
-- 在 Dashboard SQL Editor 整段执行，或 `supabase db push`。

-- ---- 1) 家长可关闭的周报开关（RLS 沿用 families 现有 family_self 策略，家长可改自己这行）----
alter table families add column if not exists weekly_report_enabled boolean not null default true;

-- ---- 2) 幂等日志：每家每「报告周」只发一次；同时供观测 ----
create table if not exists report_log (
  id bigint generated always as identity primary key,
  family_id uuid not null references families (id) on delete cascade,
  week_start date not null,                 -- 报告周的上周一（幂等键的一半）
  status text not null,                     -- sent | nudged | skip_empty | skip_disabled | skip_already | failed
  detail text,                              -- 仅状态类信息（如错误码），不存邮件正文/PII
  sent_at timestamptz not null default now(),
  unique (family_id, week_start)
);
create index if not exists idx_report_log_week on report_log (week_start);

-- report_log 与其它表一致启用 RLS 但【不建任何 policy】→ 客户端一律拒绝；
-- Edge Function 用 service_role 绕过 RLS 读写。
alter table report_log enable row level security;

-- ---- 3) 定时触发：pg_cron 每周一 00:00 UTC（= UTC+8 周一 08:00）POST 到 Edge Function ----
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 若之前已排过同名任务，先反注册再重排，保证可重复执行本迁移。
select cron.unschedule('weekly-report')
where exists (select 1 from cron.job where jobname = 'weekly-report');

-- 时区说明：cron 表达式按 UTC。默认 REPORT_TZ=Asia/Shanghai(UTC+8) → 周一 08:00 本地 = 周一 00:00 UTC。
-- 本地时区非 UTC+8 时，请同时调整此表达式与 Edge Function 的 REPORT_TZ 环境变量。
select cron.schedule(
  'weekly-report',
  '0 0 * * 1',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
