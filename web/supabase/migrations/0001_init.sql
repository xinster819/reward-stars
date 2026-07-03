-- Reward Stars Web — 初始 schema（对位 iOS SwiftData 模型 + D24 家庭模型）
-- 一个家庭 = 一个 auth 账号；全部业务行带 family_id，RLS 按 auth.uid() 隔离。
-- 不变量：历史行存快照；撤销=is_voided 软删除；每行带 child_id（每家庭随机生成，勿用全局常量）。
-- 在 Supabase Dashboard → SQL Editor 里整段执行（或 supabase db push）。

create table families (
  id uuid primary key references auth.users (id) on delete cascade,
  pin_blob text,                       -- base64(salt16 + sha256(salt+pin))，与 iOS Keychain blob 同构
  touched_at timestamptz not null default now(),  -- 破坏性操作后 bump，驱动多端 refetch（DELETE 事件不可靠）
  created_at timestamptz not null default now()
);

create table children (
  id uuid primary key,
  family_id uuid not null references families (id) on delete cascade,
  name text not null,
  avatar_symbol text not null,
  created_at timestamptz not null
);
create index idx_children_family on children (family_id);

create table rules (
  id uuid primary key,
  family_id uuid not null references families (id) on delete cascade,
  child_id uuid not null,
  name text not null,
  details text,
  category text not null check (category in ('learning', 'life', 'character', 'other')),
  points integer not null,
  icon_name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null
);
create index idx_rules_family_child on rules (family_id, child_id, sort_order);

create table events (
  id uuid primary key,
  family_id uuid not null references families (id) on delete cascade,
  child_id uuid not null,
  rule_id uuid,                        -- 软外键：规则删了历史仍在（快照）
  rule_name text not null,             -- 快照
  category text not null check (category in ('learning', 'life', 'character', 'other')),
  points integer not null,             -- 快照
  note text,
  ts timestamptz not null,
  is_voided boolean not null default false
);
create index idx_events_family_child on events (family_id, child_id, is_voided, ts desc);

create table rewards (
  id uuid primary key,
  family_id uuid not null references families (id) on delete cascade,
  child_id uuid not null,
  name text not null,
  cost integer not null check (cost >= 0),
  icon_name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null
);
create index idx_rewards_family_child on rewards (family_id, child_id, sort_order);

create table redemptions (
  id uuid primary key,
  family_id uuid not null references families (id) on delete cascade,
  child_id uuid not null,
  reward_id uuid,                      -- 软外键
  reward_name text not null,           -- 快照
  cost integer not null,               -- 快照
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null,
  decided_at timestamptz
);
create index idx_redemptions_family_status on redemptions (family_id, child_id, status);

-- ---- RLS：家庭隔离（所有表只允许 family_id = auth.uid()）----
alter table families enable row level security;
alter table children enable row level security;
alter table rules enable row level security;
alter table events enable row level security;
alter table rewards enable row level security;
alter table redemptions enable row level security;

create policy family_self on families
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy children_family on children
  for all using (family_id = auth.uid()) with check (family_id = auth.uid());
create policy rules_family on rules
  for all using (family_id = auth.uid()) with check (family_id = auth.uid());
create policy events_family on events
  for all using (family_id = auth.uid()) with check (family_id = auth.uid());
create policy rewards_family on rewards
  for all using (family_id = auth.uid()) with check (family_id = auth.uid());
create policy redemptions_family on redemptions
  for all using (family_id = auth.uid()) with check (family_id = auth.uid());

-- ---- 审批：服务端事务内复验余额（对位 iOS approveRedemption 的余额闸）----
-- 家庭行 FOR UPDATE 作为家庭级互斥锁：并发审批两笔不同兑换时串行化，防止双双通过把余额打负。
create or replace function approve_redemption(rid uuid)
returns boolean
language plpgsql
security invoker                        -- 走 RLS，只能动自己家庭的数据
set search_path = public
as $$
declare
  req redemptions%rowtype;
  bal integer;
begin
  perform 1 from families where id = auth.uid() for update;

  select * into req from redemptions
    where id = rid and family_id = auth.uid() and status = 'pending'
    for update;
  if not found then
    return false;
  end if;

  select coalesce((select sum(points) from events
                    where family_id = auth.uid() and child_id = req.child_id and not is_voided), 0)
       - coalesce((select sum(cost) from redemptions
                    where family_id = auth.uid() and child_id = req.child_id and status = 'approved'), 0)
    into bal;

  if bal < req.cost then
    return false;
  end if;

  update redemptions set status = 'approved', decided_at = now() where id = rid;
  return true;
end;
$$;

-- ---- 导入：单事务替换全家数据（客户端分步 delete+insert 会在中途失败时丢数据）----
create or replace function import_bundle(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform 1 from families where id = auth.uid() for update;

  delete from redemptions where family_id = auth.uid();
  delete from events where family_id = auth.uid();
  delete from rewards where family_id = auth.uid();
  delete from rules where family_id = auth.uid();
  delete from children where family_id = auth.uid();

  insert into children (id, family_id, name, avatar_symbol, created_at)
  select (c->>'id')::uuid, auth.uid(), c->>'name', c->>'avatarSymbol', (c->>'createdAt')::timestamptz
  from jsonb_array_elements(coalesce(payload->'children', '[]'::jsonb)) as c;

  insert into rules (id, family_id, child_id, name, details, category, points, icon_name, is_active, sort_order, created_at)
  select (r->>'id')::uuid, auth.uid(), (r->>'childID')::uuid, r->>'name', r->>'details', r->>'category',
         (r->>'points')::integer, r->>'iconName', (r->>'isActive')::boolean, (r->>'sortOrder')::integer, (r->>'createdAt')::timestamptz
  from jsonb_array_elements(coalesce(payload->'rules', '[]'::jsonb)) as r;

  insert into events (id, family_id, child_id, rule_id, rule_name, category, points, note, ts, is_voided)
  select (e->>'id')::uuid, auth.uid(), (e->>'childID')::uuid, (e->>'ruleID')::uuid, e->>'ruleName', e->>'category',
         (e->>'points')::integer, e->>'note', (e->>'timestamp')::timestamptz, (e->>'isVoided')::boolean
  from jsonb_array_elements(coalesce(payload->'events', '[]'::jsonb)) as e;

  insert into rewards (id, family_id, child_id, name, cost, icon_name, is_active, sort_order, created_at)
  select (w->>'id')::uuid, auth.uid(), (w->>'childID')::uuid, w->>'name', (w->>'cost')::integer,
         w->>'iconName', (w->>'isActive')::boolean, (w->>'sortOrder')::integer, (w->>'createdAt')::timestamptz
  from jsonb_array_elements(coalesce(payload->'rewards', '[]'::jsonb)) as w;

  insert into redemptions (id, family_id, child_id, reward_id, reward_name, cost, status, requested_at, decided_at)
  select (d->>'id')::uuid, auth.uid(), (d->>'childID')::uuid, (d->>'rewardID')::uuid, d->>'rewardName',
         (d->>'cost')::integer, d->>'status', (d->>'requestedAt')::timestamptz, (d->>'decidedAt')::timestamptz
  from jsonb_array_elements(coalesce(payload->'redemptions', '[]'::jsonb)) as d;

  update families set touched_at = now() where id = auth.uid();
end;
$$;

-- ---- Realtime：让客户端订阅家庭数据变更（families 承载 PIN 同步 + touched_at 心跳）----
alter publication supabase_realtime add table families, children, rules, events, rewards, redemptions;
