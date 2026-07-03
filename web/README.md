# 行为奖励 / Reward Stars — Web/PWA 版

iOS 原生版（仓库根目录）的 Web 移植：**保留**产品逻辑、数据结构、页面流程、业务模型；**替换** SwiftUI→React、SwiftData→Supabase(Postgres)、本地单机→家庭多设备共享。Phase 4 决策见 [DECISIONS.md](../DECISIONS.md) D23–D25。

## 运行

```bash
pnpm install
pnpm dev        # http://localhost:5173（无环境变量 = 本地演示模式，数据存浏览器）
pnpm test       # vitest：领域引擎 39+ 对位测试 + 数据层语义测试
pnpm build      # tsc 类型检查 + 产物构建（含 PWA service worker）
```

云端模式：复制 `.env.example` 为 `.env.local` 填入 Supabase 项目值；建库 SQL 在 [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql)。部署（Vercel/CF Pages）与全家使用步骤见 [SETUP.md §10](../SETUP.md)。

## 架构（对位 iOS 双层）

- `src/domain/` — RewardCore 1:1 移植：`ScoringEngine`（余额/周净分/趋势）、`StreakCalculator`、`BadgeEngine`、`RedemptionPolicy`、`PINHasher`（盐+SHA-256）、`SampleData`。纯函数、注入 `now`，离线确定性测试。
- `src/data/` — 持久化：`mutations.ts` 承载全部写语义（**快照**：历史行冻结当时的规则名/分值；**软删除**：撤销= `isVoided`；**childID** 齐备；审批需余额 ≥ cost），`localRepo`（localStorage）与 `supabaseRepo`（乐观更新 + Realtime 重取 + 服务端审批 RPC）实现同一 `RewardRepo` 接口。
- `src/ui/` — 13 屏复刻：孩子端（今天/奖励商店/记录）+ 家长端（总览/记分/规则/奖励/历史）+ 模态（PIN 门禁 4 位自动校验、5 错锁 30 秒/引导轮播+必填设置/家长设置/规则与奖励编辑/备注）。
- `src/i18n/strings.ts` — 中文为源 key 的双语词典（对位 xcstrings + DomainLocalization）。

## 角色与共享模型（D24）

一个家庭 = 一个 Supabase 账号；所有设备登录同一账号。任何设备默认**孩子（只读+申请兑换）**视图，家长功能凭 4 位 PIN 解锁（哈希随家庭同步）。RLS 按 `family_id = auth.uid()` 隔离。

## 已知边界

- 云端核心路径**已在真实 Supabase 项目实测**（2026-07-03）：注册/登录、seed、PIN 同步、记分、审批 RPC、Realtime 跨端同步、RLS 家庭隔离（含跨家庭写入拒绝）。未逐一实测：事务化导入 RPC、撤销/清零的跨端传播（同类 SQL 路径已覆盖）。
- iOS 备份 JSON → Web 导入：字段同构 + Swift 日期数值兼容层已写，未用真实备份实测。
- Web 无生物识别解锁（iOS 的 Face ID 路径以 PIN 替代）。
- **安全模型 = 客户端软防护**（D24）：孩子设备共享家庭已认证会话，家长门禁防误触/偷改，不防懂技术的攻击者（与 iOS 单设备 PIN 门禁同级）。PIN 锁定（5 错 30 秒）在刷新页面后重置，同理属软防护。
- Realtime 的 DELETE 事件按 Supabase 文档不走 filter → 删除类操作靠 `families.touched_at` 心跳 + 页面 focus 校准兜底（【推断·待云端实测】）。
