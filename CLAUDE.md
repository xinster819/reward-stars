# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 行为奖励 / Reward Stars — 多期自治开发宪章

> 本文件每次会话自动加载，是本项目跨期工作的**强制契约 + 教训库**。
> 多期项目（Phase 1、2、3…）。除非**物理上必须用户提供**，否则**一律不停下来问，用合理默认值自主决策并继续**，关键决策写入 [DECISIONS.md](DECISIONS.md)。
> 本宪章移植自 financial_assistant 项目（同栈：Swift / SwiftUI / xcodegen / Superpowers）并按本项目改写。
>
> **物理上必须用户提供的（只有这些才停下来问／汇总到 SETUP.md 待补）**：
> Apple 开发者账号($99) · App Store Connect 上传/截图/定价 · 真机签名 `DEVELOPMENT_TEAM` · 真实孩子姓名/照片/数据 · 中国区软著+工信部备案 · App Store Connect 品牌名预留。

## §0 每期开工第一步（强制，先做再 brainstorm）
1. **朗读「§5 教训库」全部条目并确认会遵守**，再进入 brainstorm。
2. 确认期号：见 [PHASES.md](PHASES.md)。
3. 新建/续写 `.learnings/phase-<N>.md`（本期踩坑实时记录）。

## §1 Superpowers 全流程（每节点自动进入下一个）
brainstorm → spec → plan → TDD（**先写测试再写实现**）→ subagent 执行 → two-stage code review（组件级 + 全分支 final）→ systematic debugging → 可运行自测通过才停。
- skill 未在本会话注册时，直接读 `~/.claude/plugins/cache/superpowers-marketplace/superpowers/*/skills/*/SKILL.md` 并忠实执行。**user instructions 优先于 skill 的"等用户确认"硬门**（§2 即用户指令：纯 loop 不停下来要确认）。

## §2 纯 loop 自主决策规则
- **不给用户看 spec/plan 等确认**——自己写、自己执行、自己迭代；理由写 DECISIONS.md。
- 任何选择（技术/数据源/UI/阈值/通知/文案/默认值）直接选最优，DECISIONS.md 写明理由 + 备选。
- 需要用户物理资源（见顶部清单）：**不停**。用占位/示例/mock 跑通，需用户补的汇总到 [SETUP.md](SETUP.md)。本项目无密钥/后端，故无 `.env`。
- 真实数据：先用示例数据（`RewardCore/SampleData.swift` / 通用插画头像 / 默认孩子名「宝贝 / My Child」）跑通，用户最后替换。
- 普通报错进 systematic-debugging 自行解决，不抛给用户。

## §3 每期收尾清单（必须全做）
- [ ] **成本核算**：`npx -y ccusage@latest session`（本期=对应 session 行；单会话跨多期记合并并注明）→ 追加一行到 [COST_LOG.md](COST_LOG.md)。
- [ ] **自进化**：retrospective 子代理读本期 git 历史 + `.learnings/phase-<N>.md` + 两阶段 review 发现 → `.learnings/retro-<N>.md`，归纳"重复失败模式"；通用规则**追加**进 §5（带 ❌/✅，先做存在性/差异性检查，**只追加不覆盖**）；可复用技法用 superpowers `writing-skills` 生成新 skill（TDD-for-docs：子代理无 skill 复现失败 → 写 skill → 验证）。
- [ ] **交付物齐全**：README / DECISIONS.md / SETUP.md / MIGRATIONS.md / COST_LOG.md / CLAUDE.md / PHASES.md。
- [ ] **汇报**：SETUP + 运行方式 + DECISIONS 摘要 + 本期成本&累计 + 本期沉淀（新增哪些 §5 规则/新 skill）。

## §4 项目坐标（架构 / 命令 / 不变量）

**是什么**：面向家长的孩子行为奖惩 iOS App（ABA 代币经济）。中文「行为奖励」/ 英文「Reward Stars」。双语（zh-Hans 为源语言 / en），iOS 17+，universal（iPhone+iPad），**纯本地、无后端、无账号**。正为 App Store 上架做准备。

### 命令
```bash
# 领域单测——快、无需模拟器（主反馈环；闸门）
cd RewardCore && swift test
cd RewardCore && swift test --filter ScoringEngineTests   # 单个测试类/用例

# 生成工程——增/删/改名任何源文件或改 project.yml 后【必须】先跑；文件未变可跳过
xcodegen generate

# App 测试 + 端到端 XCUITest（模拟器；destination 名须匹配已安装 runtime）
xcodebuild test -project RewardingSystem.xcodeproj -scheme RewardingSystem \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
# 单个测试 / 仅门禁 UI 测试
xcodebuild test ... -only-testing:RewardingSystemTests/RewardRepositoryTests
xcodebuild test ... -only-testing:RewardingSystemUITests
# 仅编译（如 iPad）
xcodebuild build ... -destination 'platform=iOS Simulator,name=iPad Pro 11-inch (M5)'
```
Scheme：`RewardingSystem`。无独立 linter，靠 Swift 编译告警。三层测试：`RewardCore`（`swift test`）/ `RewardingSystemTests`（App 单测）/ `RewardingSystemUITests`（XCUITest）；当前数量见 HANDOFF.md。

### 架构（大图：两层，单向依赖 UI → 持久化 → 领域）
- **`RewardCore/`** 纯 Foundation Swift Package，承载**全部业务规则**为确定性值类型 + 引擎：`ScoringEngine`（余额/周/区间净分/每日趋势）、`StreakCalculator`、`BadgeEngine`、`RedemptionPolicy`，加 `PINHasher`、`SampleData`。引擎注入 `now`/`Calendar` → `swift test` 离线确定性覆盖（无时钟/时区/随机）。
- **`App/`** SwiftUI + SwiftData。`Persistence/`（`@Model` 实体 `SwiftDataModels.swift` + 唯一写入口 `RewardRepository`）；`Auth/`（`RoleManager` / `PINStore`(Keychain) / `BiometricAuth`）；`Views/{Child,Parent,Auth}`；`Support/`（Theme / 共享组件 / `ScoreSummary` / `AppConfig` / `DomainLocalization`）。
- **读路径**：视图 `@Query` 订阅 SwiftData → `.map { $0.toDomain() }` → 喂引擎 / `ScoreSummary`（只有 `@Query` 驱动刷新）。**写路径**：视图从 `@Environment(\.modelContext)` 构造轻量 `RewardRepository` 调 mutation。
- 持久化 ↔ 领域 1:1（`toDomain()` / `init(_:)`）。模型不变量：历史行存**快照**（事后改规则不篡改历史）；撤销=**软删除**（`isVoided`，处处排除）；每条业务行带 **`childID`**（多孩子预留，MVP 单孩子，`@Query` 暂未按 childID 过滤）。
- 入口：`RewardingSystemApp` 经 `PersistenceController.makeContainer()`（迁移计划+打开前备份）建容器→空库 seed→首启写演示 PIN→`RootView` 按 `RoleManager.role` 切 `ChildTabView`（默认只读）/`ParentTabView`。

### 验证基线（闸门）
`swift test` 绿 + `xcodebuild test` 绿（含 XCUITest）+ 模拟器启动渲染正常。改源文件集合后先 `xcodegen generate`。

## §5 教训库（只记「已验证·会重复」的；保持精炼，只追加不覆盖）
> 标注「移植」= 来自 financial_assistant、本项目同栈适用但尚未在本项目复现；其余为本项目已发生。

1. **隐私：真实数据/截图绝不进 git；收到报错先确认它属于本项目。**
   - ❌ 真实孩子照片 `assets-src/20260621-150859.jpeg` 已落入本仓 git 历史（虽不打包进 App）。（移植源项目曾把真实持仓截图+SETUP 提交进 git，还差点去 debug 别的项目的崩溃日志。）
   - ✅ 真实数据放 git-ignored；公开/提交前 `git grep -nE "<真实标记>" HEAD` 扫一遍；收到崩溃/日志先比对 bundle id/包名/路径是否属于本项目，不属于先指出再确认，绝不动别的 repo。

2. **SwiftUI Identifiable 列表禁止重复 id。**
   - ❌（移植）向「id 由字段派生」的列表直接 `append` 产生重复 id → `ForEach`/swipe-delete 行错位、删错行。
   - ✅ 写入前按 id 去重/合并（upsert）。本项目注意：`childID`、规则/奖励 `id` 等派生 id 同理。

3. **不臆造外部/框架行为，先核实；测试离线确定性。**
   - ❌（移植）差点把未实测的数据源当回退。
   - ✅ 不确定的 API/框架行为先实测再断言；测试对**提交的夹具/注入值**跑，不依赖网络/真实时钟。结论标【已查证·出处】/【推测·待确认】。

4. **带时间/sleep/退避的逻辑，时间与延时要可注入；测试传确定值保持快。**
   - ❌（移植）退避延时硬编码 → 单测从 0.02s 涨到 3s。
   - ✅ 时间走注入的 `now`/`Calendar`（RewardCore 引擎已如此）；延时 `init(... baseDelay:)` 测试传 `.zero`。本项目例：PIN 锁定 30s、连击/趋势的"今天"边界都应可注入测试。

5. **不轻信 subagent 自报，控制器独立复验。**
   - ✅ subagent 报 DONE 后，控制器自己跑 `swift test` / 看 `git diff` 取证再标完成（Superpowers verification-before-completion）。

6. **改共享层后，回归验证被波及的旧路径，不止验新功能。**
   - ✅ 改 `RewardRepository` / 迁移 / `PersistenceController` / 共享组件后，回归相关旧路径（如记分-撤销-兑换、迁移保历史、角色门禁），而非只验新增功能。

7. **xcodegen 工程：增/删源文件后，先 `xcodegen generate` 再 `xcodebuild`。**
   - ❌（移植，本项目同样适用）新建 `XxxView.swift` 后直接 `xcodebuild` → `cannot find 'Xxx' in scope`（文件不在 .pbxproj）。
   - ✅ 改动源文件集合后先在仓库根 `xcodegen generate` 再编译。

8. **用户数字输入：解析必须 locale-aware，且只接受有限值——别用 `Double(String)`。**
   - ❌（移植）`Double(amountText)` 只认 "."，逗号小数 locale（de_DE…）下 "1,5"→nil→静默变 0；且 `Double("nan")`/`("inf")` 解析成功会毒化汇总。
   - ✅ 用 `FormatStyle`（`TextField(value:format: .number)` 默认按 locale）或 locale 注入的 `NumberFormatter` 解析 + `.isFinite` 闸；纯函数做离线确定性测试。**凡解析用户键入的数字（规则分值/兑换花费/直接分数输入，见 DECISIONS D17）都过 locale + 有限性两道闸。**

## 配套文档（动手前必读）
HANDOFF.md（实时状态+踩坑）· tasks.md（任务）· DECISIONS.md（决策 D0–，改架构前读、做决策后追加）· MIGRATIONS.md（改 `@Model` 强制流程）· SETUP.md（真机安装）· PHASES.md（期号）· COST_LOG.md（成本）· README.md（最全概览）· `docs/superpowers/specs/`（已批准设计）。
