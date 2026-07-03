# HANDOFF.md — 状态快照

> 给任意新 session 无损接手用。指向文件路径，不贴大段代码。不确定处标【待确认】。
> 更新于 2026-07-02，HEAD `fd12daf`（**「全新历史」单提交仓库**，D21/D22 清真实照片后重建；下文出现的旧 commit 哈希是重建前历史，仅作叙事参考，git 里已不存在）。分支 `main`。

## 一句话目标
面向普通家长的**孩子行为奖惩 iOS App**（ABA 代币经济）—— 中文「行为奖励」/ 英文「Reward Stars」。已是可运行的**双语 MVP**，正为 **App Store 上架**做准备（iOS-only，先做）。

## 技术栈 / 构建运行测试
- **Swift + SwiftUI + SwiftData**，iOS 17+，universal（iPhone+iPad），中英双语，纯本地无后端无账号。
- 双层架构：`RewardCore/`（纯领域 Swift Package，可 `swift test`）+ `App/`（SwiftUI/SwiftData）。
- 工程用 **XcodeGen** 从 [project.yml](project.yml) 生成（`.xcodeproj` 已提交，可直接打开）。
- 命令：
  - 领域单测：`cd RewardCore && swift test`（39 个）
  - App 全测：`xcodebuild test -project RewardingSystem.xcodeproj -scheme RewardingSystem -destination 'platform=iOS Simulator,name=iPhone 17 Pro'`（25 单测 + 4 UI）
  - **改/增删源文件后须** `xcodegen generate`
- 真机装机步骤见 [SETUP.md](SETUP.md)；数据迁移规范见 [MIGRATIONS.md](MIGRATIONS.md)；决策见 [DECISIONS.md](DECISIONS.md)（D0–D18）。

## 已完成（指向 commit / 文件）
- 领域引擎 + TDD：`RewardCore/Sources/RewardCore/Engine/*`（`efb6880`）
- 持久化 + 仓库 + 角色/PIN：`App/Persistence/*`、`App/Auth/*`（`2c6fdbe`）
- 全套 UI（家长/孩子/门禁/商店/历史/设置）：`App/Views/**`（`3f458a6`）
- 两阶段评审修正（`8badd74`）、端到端门禁 XCUITest（`fe95d7d`，`UITests/RoleGateUITests.swift`）
- iPad 角色切换偶发崩溃修复（`307156d`，详见 DECISIONS D15）
- 改名/清零/干净初始化（`2916e6f`）、头像上传 + 规则描述 + 分数直接输入（`7b33945`）
- **数据迁移 + 备份体系**（`9c5cf18`，`App/Persistence/{SchemaVersions,PersistenceController,DataBackup}.swift`）
- 上架就绪 part1：品牌图标 / 通用头像 / 隐私政策（`811da30`）→ 改用插画图标+头像（`266248f`）
- **英文本地化**（`4f17d97`，bilingual，DECISIONS D18，`App/Localizable.xcstrings` + `App/InfoPlist.xcstrings` + `App/Support/DomainLocalization.swift`）
- **App Store 代码侧上架准备**（`81af87e`）：隐私清单 `App/PrivacyInfo.xcprivacy`（不追踪/不采集/仅 UserDefaults CA92.1，**已独立复验进 Release 包**）+ 导出合规 `ITSAppUsesNonExemptEncryption = NO`（**已验进构建 Info.plist**）+ 提交指南 `docs/appstore/SUBMISSION.md`（ASC 步骤 + 中英元数据草稿）。
- **App Store 截图**（`1554c20`）：20 张原生分辨率（iPhone 6.9"=1320×2868 / iPad 13"=2064×2752），5 屏 × 中英 × 两机型，全 SampleData。脚本 `docs/appstore/generate-screenshots.sh`（经 app 的 `#if DEBUG` 启动钩子直达各屏，**新增 DEBUG-only `UITEST_SEED_FULL`**=`RewardRepository.resetAndSeedFullSample` 注入含流水的完整示例使总览非空、随启动语言本地化；Release 不受影响）。已逐张视觉复验。
- 测试合计：RewardCore 39 + App 单测 25 + UI 4 = **68，全绿**（A2 后增至 39 + 32 + 6 = **77**；现 iPhone：RewardCore 39 / App 单测 36 / UI 8）。

## 进行中（卡在哪 / 下一步）
- **2026-06-23 resume**：✅ A1 品牌名（D19）；✅ 采用自治宪章（D20）；✅ **A2 首启 onboarding 实现完成**（`App/Views/Onboarding/{OnboardingView,OnboardingSetupView}.swift` + `App/Support/OnboardingSetup.swift` + `RootView`/`App.init` 门禁 `@AppStorage("hasSeenOnboarding")`；新装展示、`UITEST_RESET` 升级跳过、`UITEST_ONBOARDING=1` 测试钩子），77 tests 全绿，已合并入 `main`（`86c5405`/`7ce5938`）。✅ **A3 英文文案润色**（通读自然、176/180 译全，微调 2 处）。
- **2026-06-24**：✅ 引导**改版为「演示型」live 预览**（复用 `ProgressRing`/`RewardStoreCard`/`PointPill` + 示例数据 + 入场动画，零改动上架屏、零新增本地化）+ ✅ **PIN 输入限 4 位**（onboarding 设置 & Settings `ChangePINView`，纯函数 `OnboardingSetup.sanitizedPIN`）。iPhone 全绿（单测 36 / UI 7 / RewardCore 39），已并入 `main`（`044a574` 改版、`efb7e75` PIN）。A1–A4 文档亦已提交（`08f6117` 等）。⚠️ 引导/UI 测试**以 iPhone 为准**（iPad 模拟器对 `fullScreenCover` 内 `SecureField` 打字不稳，非真机问题，见 `.learnings/phase-3.md`）。✅ App 加「**联系我们**」入口（家长设置→关于，`AppConfig.contactEmail = xinster819ca@gmail.com`，mailto；并入 main `8de2163`），同邮箱已填入 `PRIVACY.md` + `docs/privacy-page/index.html`。tests：App 单测 36 / UI 8 / RewardCore 39 全绿。Phase 3 仅剩 **A4 隐私 URL = 用户物理阻塞**（邮箱已填，**只剩用户托管取 URL**，见 `docs/privacy-page/index.html` + SETUP.md §8）。**工作模式 = 多期自治宪章（loop engineering mode，DECISIONS D20）**：见 `CLAUDE.md`（§0–§5）+ `PHASES.md` + `COST_LOG.md` + `.learnings/`。自此不就 spec/plan 逐项停下要确认，自主决策+写 DECISIONS；仅"物理必须用户提供"项（Apple 账号/ASC/真机签名/真实孩子数据/中国区备案/名称预留）停下汇总到 SETUP.md。
- **2026-06-24 resume**：✅ 落地并合并 **App Store 代码侧上架准备**（`81af87e`，见上"已完成"）。**已独立复验**：`swift test` 39 绿、`xcodebuild test` 全绿（App 单测 36 / UI 8）、**Release 构建成功**且 `PrivacyInfo.xcprivacy`(883B) + `ITSAppUsesNonExemptEncryption=false` 确实进了产物。✅ **并已生成上架截图**（`1554c20`，20 张，见上）。**至此代码/资产侧上架准备全部完成——剩余 100% 为用户物理阻塞**：Apple 开发者账号 $99 / ASC 建 App + 上传构建 + 传截图 + 定价 / 隐私政策 URL 托管（`docs/privacy-page/index.html` 待用户托管）/ 中国区软著 + 工信部备案。截图与提交元数据草稿均已备好（`docs/appstore/`），用户拿到账号后照 `SUBMISSION.md` 点击即可。
- **2026-07-02 resume**：用户拍板**代码冻结**，本次只做重建历史后的基线复验 + 交接文档清扫。✅ **基线全绿（重建后首次全量验证）**：`swift test` 39 / App 单测 36 / UI 8（iPhone 17 Pro 模拟器，UI 测试含真实启动渲染），0 失败；✅ 交付物齐全复验（PrivacyInfo.xcprivacy / SUBMISSION.md / 截图 20 张 / privacy-page 邮箱已填）；✅ `git rev-list --objects --all` 复验对象库**无照片残留**。✅ SETUP.md 清扫：§8 两处过时事实修正（"历史含照片"重建后已不成立、邮箱已填无需再改）+ 新增 **§9 上架物理项清单**；§2 补首启引导页说明。**改动未 commit（git 默认只读），留工作区等用户指示。**
- **2026-07-02/03（Phase 4 开工，用户 /goal）**：**放弃 App Store 路线**（无开发者账号，免费签名 7 天过期），核心功能迁 **Web/PWA**（保留产品逻辑/数据结构/页面流程/业务模型；SwiftUI→React、SwiftData→Supabase、单机→家庭多端共享）。决策 D23–D25，spec `docs/superpowers/specs/2026-07-02-web-pwa-migration.md`。**已完成（web/ 目录，iOS 侧未动）**：领域层 TS 移植+53 条 vitest 全绿、数据层双适配器（localStorage 全功能演示模式 + Supabase 云适配器）、Supabase SQL(表+RLS+审批RPC)、13 屏 UI 复刻+双语+PWA(manifest/SW/图标复用品牌插画)、`pnpm build` 绿、**dev server 端到端手动验证通过**（引导→孩子端→PIN门禁→记分→撤销→兑换→审批→余额，中英/移动端/持久化/零 console 错误）。命令：`cd web && pnpm test` / `pnpm build` / `pnpm dev`。⚠️ 云端行为【未验证·待用户接线，SETUP.md §10】。
- **2026-07-03 两阶段评审 + 修正完成**：code-reviewer 22 条发现全部处置（见 tasks.md E 节详录；含 2 critical：云端 childID 全局 PK 冲突、云导入无事务）。修后基线：`cd web && pnpm test` **53/53 绿**、`pnpm build` 绿、预览端到端复验通过（引导→门禁（锁定跨弹窗持久+过期解锁）→家长 Tab）。
- **2026-07-03 云端接线 + 全链路实测通过**：用户建好 Supabase 项目（`znxqlxxrqtajlaefiwnw`，Mumbai）+ 跑了建表 SQL + 关闭 Confirm email；`web/.env.local` 已配置（publishable key，git 忽略）。实测全绿：注册即登录 → 云 seed → PIN 上云+门禁 → 记分快照 → **审批 RPC** → **Realtime 跨端同步**（5 秒内自动更新）→ **RLS 家庭隔离**（第二家庭零可见+跨家庭写拒绝）。顺带修：注册无 session 时的提示（Confirm email 场景）。教训：GoTrue 拒收 example.com 测试邮箱；免费档邮件限流极低（家庭场景务必关邮件确认）。
- **2026-07-03 🏁 Phase 4 完成（用户实测确认）**：`*.vercel.app` 移动网络被拦 → 购 `eduinspire.fun`（腾讯云 ¥10/年）→ DNS 直绑 Vercel → **移动 5G/WiFi 实测可用**。照片头像功能回归（`0d82edc`，canvas 128px data:URL 存库）。期末：`swift test` 未动（iOS 冻结）、web 53/53 绿、成本 $128.20 入 COST_LOG、教训升 §5#9/#10、复盘 `.learnings/retro-4.md`。
- **阶段 = Phase 4 已收尾。正式地址 https://eduinspire.fun**（备用 reward-stars.vercel.app，大陆可能拦）。用户待办：其余设备加主屏、改 PIN/账号密码、删 e2e 测试账号、域名明年续费。后续增强见 PHASES「Phase 5+」。**2026-07-03 用户授权后已 commit（`d868b0d`）并 push 到 `git@github.com:xinster819/reward-stars.git`。**
- **2026-07-03 🚀 上线**：Vercel 注册一度被拒（申诉后成功）；期间备过 GitHub Pages 方案（vite 支持 BASE_PATH 保留，工作流已撤、恢复自 `f1e7ff6`）。最终 **Vercel 部署成功：https://reward-stars.vercel.app**（线上验证：标题/manifest/sw/图标/云配置全 ✓；push main 自动重部）。测试家庭账号 `xinster819+family@gmail.com`（小星/PIN 1234）。剩余：全家设备大陆可达性实测（不稳→自定义域名+Cloudflare）；遗留小项见 tasks.md E 末条。
- **2026-07-03 iPad 真实数据已迁云端**：签名过期不碍事，`devicectl` 沙盒直读 + sqlite3 读 store（JSON 快照比 WAL 旧 4 天，弃用）→ `import_bundle` RPC 单事务导入 → 余额/条数/线上 UI 三重复验一致。数据文件与云端旧数据快照均在 scratchpad（不进 git）。迁移技法沉淀在 `.learnings/phase-4.md`。
- ⚠️ **真机落后 HEAD**：用户 iPad 上是较早构建；**最新 3 个提交（插画图标/头像、隐私、英文本地化）尚未装机**——用户上次选择"先不装"。如要装：**覆盖安装**（绝不卸载，见已知坑），装后让用户重传孩子头像。
- 变现已定：**一次性最低价付费**（≈¥1 / $0.99），**无需内购代码**（价格在 App Store Connect 设）。
- 深度调研（费用 / 儿童类目合规 / 中国区备案 / PIPL）结论在**本次会话记录**里，**未落仓库**；其中"竞品定价 / 转化率 / 收入区间"**未通过核实**（属空白）。【待确认：是否要落一份 RESEARCH.md】

## 待做（按依赖顺序）
1. ✅ 英文品牌名已定（2026-06-23）：保留 `Reward Stars`（en）/`行为奖励`（zh），见 DECISIONS D19。无需改文件；上传若被占→备选 Bravo Stars → Tally Stars。
2. 引导页 / 首启 onboarding。
3. 英文文案润色（`App/Localizable.xcstrings`）。
4. 托管 [PRIVACY.md](PRIVACY.md) 取公开 URL + 填 `<联系邮箱>`。
5.（用户）开发者账号 $99；App Store Connect 上传 / 截图 / 定价。
6.（用户·中国区）软著 + 工信部备案。
7. 后续增强：iCloud 同步、多孩子放开（数据已就绪）、iPad NavigationSplitView。

## 已知坑 & workaround
- **真机升级必须"覆盖安装"，绝不先卸载**（卸载清本机数据）；开发期清数据用「家长设置 → 重置」。
- `xcodebuild`（CLI）**不会自动回写 String Catalog** → 改文案后用 `xcrun xcstringstool sync App/Localizable.xcstrings --stringsdata <…>` 抽取（.stringsdata 在 DerivedData 的 `Build/Intermediates.noindex/...RewardingSystem.build/.../Objects-normal/arm64/`，**排除 `Index.noindex`**），再补 en 译文。
- `find …RewardingSystem.app` 会命中 `Index.noindex` 的**空壳**（无 Info.plist）→ 安装报 "not a valid bundle"；过滤 `Index.noindex`。
- `devicectl … launch` 报 **"Locked"** = iPad 锁屏，**不是 bug**；解锁即可。
- 复用组件文案要本地化必须用 `LocalizedStringKey` 类型（`Text(String)` 不本地化）；领域字符串走 `App/Support/DomainLocalization.swift` 的 `loc()`。
- UI 测试 `RoleGateUITests` 已固定 `-AppleLanguages (zh-Hans)`，否则模拟器英文环境下中文文案查询会失败。
- 改 `@Model` 必须照 [MIGRATIONS.md](MIGRATIONS.md)（加可选字段 = 自动轻量迁移，已实测；改名/转换 = custom）。
- **默认演示 PIN = 1234**；视图层 `@Query` 暂未按 childID 过滤（单孩子无影响，扩展多孩子需加 `#Predicate`）。
- ✅ **真实孩子照片已清除**：公开化时用「全新历史」重建仓库（单初始提交，无旧历史），`assets-src/` 已删并 gitignore，提交信息与文档中的真名亦已去除（见 D21）。本地全量备份 bundle 在 scratchpad（未推送）。

## 关键决策
见 [DECISIONS.md](DECISIONS.md) D0–D19。要点：XcodeGen(D1)、双层架构(D2)、SwiftData(D3)、PIN+生物识别(D6)、childID 预留多孩子(D7)、软删除撤销(D8)、迁移+备份(D16)、头像/描述/分数输入(D17)、英文本地化机制(D18)、英文品牌名保留 Reward Stars(D19)。

## 如何运行 / 测试
见上"构建运行测试"。模拟器英文验证：launch 时加 `-AppleLanguages "(en)" -AppleLocale "en_US"`。
