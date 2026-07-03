# PHASES.md — 期号台账

> 配合 [CLAUDE.md](CLAUDE.md) §0 使用。每期一段：范围 / 状态 / 关键提交。

## Phase 1 — MVP（已完成）
领域引擎 + TDD、持久化 + 仓库、角色/PIN/生物识别门禁、全套家长/孩子 UI、端到端门禁 XCUITest、iPad 切换崩溃修复、改名/清零/干净初始化、头像上传+规则描述+分数直接输入。
提交：`efb6880` `2c6fdbe` `3f458a6` `8badd74` `fe95d7d` `307156d` `2916e6f` `7b33945`。

## Phase 2 — 加固 + 上架就绪 part1（已完成）
数据迁移 + 备份体系；品牌图标 / 通用头像 / 隐私政策 → 改用插画图标+头像；英文本地化（双语 zh-Hans/en）。
提交：`9c5cf18` `811da30` `266248f` `4f17d97`；交接文档 `2bd87b5`。

## Phase 3 — App Store 上架准备（当前）
范围（见 [tasks.md](tasks.md) A）：
- A1 英文品牌名 —— ✅ 已定保留 `Reward Stars`（DECISIONS D19）。
- A2 首启 onboarding（教程 + 设家长 PIN + 设孩子名；教程可跳过，设置必填）—— ✅ 已完成并入 main，含「演示型」live 预览改版（复用真实组件）+ PIN 限 4 位（onboarding & Settings）。tests 全绿（iPhone：39/36/7）。spec：`docs/superpowers/specs/2026-06-23-onboarding-design.md`，plan：`docs/superpowers/plans/2026-06-23-onboarding.md`。
- A3 英文文案润色 —— ✅ 通读自然、176/180 译全（3 个格式串无需译），微调 2 处。
- A4 托管 PRIVACY.md 取 URL + 填联系邮箱 —— ⛔ 用户侧物理阻塞（需托管 + 联系邮箱），见 SETUP.md。
- 采用多期自治开发宪章（DECISIONS D20）。
物理阻塞（用户侧，见 [tasks.md](tasks.md) B / CLAUDE.md 顶部清单）：开发者账号、App Store Connect、中国区软著+备案。

## Phase 4 — Web/PWA 迁移（✅ 完成，2026-07-02 ~ 07-03，用户 /goal）
**成果：https://eduinspire.fun 上线，移动网络实测可用（用户确认）。** iPad 历史数据已无损迁云。详见 HANDOFF / tasks E 节。

背景：无 iOS 开发者账号，免费签名 7 天过期 → 原生 App 无法长期稳定使用。用户定向：核心功能迁 Web/PWA，**保留**产品逻辑/数据结构/页面流程/业务模型；**替换**原生 UI→Web UI、本地 SQLite→云数据库、单机→多人共享；部署 Vercel/CF Pages + Supabase/Firebase + 自定义域名，Safari 加主屏。
范围与决策：见 DECISIONS **D23–D25**（Vite+React+TS SPA / Supabase(Postgres+RLS) / 家庭账号+PIN 角色门禁 / 存储抽象层：local 适配器无账号可全量验证）。iOS 工程保留不动（冻结）。
物理阻塞（用户侧，汇总 SETUP.md）：Supabase 项目创建 + Vercel/CF 账号 + 自定义域名。

## Phase 5+ — 增强（未排期）
多孩子放开（数据已就绪）、iOS 数据导入 Web 的迁移工具、iPad 专属 NavigationSplitView（如回归原生）。
