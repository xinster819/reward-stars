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

## Phase 4+ — 增强（非上架阻塞，未排期）
iCloud 同步（CloudKit）、多孩子放开（数据已就绪，需 UI + `@Query` 按 childID 过滤）、iPad 专属 NavigationSplitView。
