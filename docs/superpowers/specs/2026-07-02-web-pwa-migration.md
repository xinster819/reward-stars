# Spec — Phase 4：迁移 Web/PWA（2026-07-02，自主批准 per D20）

目标（用户 /goal）：核心功能迁 Web/PWA。**保留**：产品逻辑、数据结构、页面流程、业务模型。**替换**：SwiftUI→React、SwiftData→Supabase(Postgres)、单机→家庭多端共享。部署 Vercel/CF Pages + 自定义域名，Safari 加主屏。决策：DECISIONS D23–D25。

## 架构（对位 iOS 双层）
- `web/src/domain/` = RewardCore 1:1 移植（纯函数、注入 now、vitest 39+ 对位测试）。
- `web/src/data/` = 持久化层：`mutations.ts`（纯快照变换，承载全部写语义：快照、软删除、childID、审批余额闸）+ `localRepo`（localStorage，无账号全功能）+ `supabaseRepo`（同接口，云多端）。
- `web/src/ui/` = 13 屏（3 childTab + 5 parentTab + 5 modal），流程/文案/交互复刻 iOS（详见下）。
- `web/supabase/migrations/0001_init.sql` = 表结构 + RLS（family 隔离）。

## 不变量（与 iOS 相同，必须保持）
历史行存快照（ruleName/points/category、rewardName/cost）；撤销=isVoided 软删除，处处排除；每行带 childID；审批时余额 ≥ cost 才可 approve；余额=非voided事件和−approved兑换和；每周一为周起始。

## UI 规格（勘探自 iOS 源码，2026-07-02）
- 色板：accent #FF9500 / positive #34C759 / negative #FF3B30 / 类目 learning #007AFF、life #34C759、character #FF2D55、other #FF9500。圆角 14–18px，卡片间距 12–16px，网格最小列宽 150–165px。
- 屏结构：孩子端 Today（问候+头像、余额卡=周进度环+总分+周/连击/徽章、下一目标卡、徽章横滚、最近 8 条）/ Rewards（余额横幅、奖励网格：可兑换 Redeem / 差 X 分 / 待确认、我的兑换 8 条）/ Activity（7 天柱状趋势、全部记录）。家长端 Overview（4 统计块=总分/本周净/连击/待审批、待审批列表、趋势、最近、撤销按钮）/ Scoring(奖励绿区+扣分红区网格、记录后顶部横幅+撤销、备注 sheet)/ Rules（列表+启停+增删改）/ Rewards（目录+待审批）/ History（趋势、按类目净分、全部/奖/罚过滤、撤销）。模态：PIN 门禁、引导轮播 4 页、设置、备注、改 PIN。
- PIN 门禁：4 圆点（18px，橙=已填）、3×4 数字键盘（max 360px）、第 4 位自动校验、错误抖动清空、5 错锁 30s（红字「尝试次数过多，请 30 秒后再试」+ 40% 透明禁用）。Web 无 Face ID → 仅 PIN（对位 iOS 生物识别回退语义）。
- 引导：4 页轮播（欢迎星星动画/双模式/记分演示环 64→74/兑换演示卡 14→20）可跳过 → 必填设置（孩子名 trim 非空 + PIN 4 位两次一致）→ hasSeenOnboarding。
- 记分直接输入（D17）：幅度 1–9999 数字输入 + 奖/罚切换定符号；**locale 感知解析 + isFinite 闸（教训 #8）**。
- 兑换双确认：孩子请求→pending；家长端余额不足则 Approve 禁用+红字「积分不足（需 X，余 Y）」；approve 时 repo 再验余额。
- 双语 zh/en：词条表已勘探（40+ 组），`src/i18n/strings.ts` 单源。

## Web 新增（iOS 没有的最小必要件）
- 家庭账号登录页（Supabase email+密码；本地模式无需登录）（D24）。
- PWA：manifest + SW（vite-plugin-pwa），图标复用 App 品牌插画。
- 模式指示：本地演示模式 vs 云端已连接（设置页显示）。

## 验证基线（本期闸门）
`pnpm test`（vitest 领域+数据层全绿）+ `pnpm build`（tsc+vite 零错误）+ 本地 dev server 手动走通：引导→孩子端→PIN→家长记分→撤销→兑换审批。云端路径【未验证·待用户接线】。

## 物理项（SETUP.md 汇总）
Supabase 建项目+跑 SQL+env、Vercel/CF 部署、绑域名。
