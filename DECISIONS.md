# DECISIONS.md — 自主决策记录

> 纯 loop engineering 模式下所有关键决策与理由。用户事后审阅。
> 格式：每条含【决策】【理由】【备选/未采纳】。日期为绝对日期。

## D0 — 工作流与协作模式（2026-06-20）
**决策**：采用 Superpowers 全流程（brainstorm→spec→plan→TDD→subagent→two-stage review→systematic debugging），但按用户明确指令以**全自主**方式执行——不就 spec/plan/选型停下来征求确认，决策记录于本文件。
**理由**：用户在 Project_brief 中明确"不要给我看 spec/plan 等确认""遇到任何选择直接选最优并继续"。用户显式指令优先级高于 skill 默认的人工确认 gate。
**备选**：标准交互式 brainstorming（每步等用户确认）——被用户明确否决。

## D1 — 构建/工程生成方式（2026-06-20）
**决策**：用 **XcodeGen**（已装 2.45.3）从 `project.yml` 生成 `.xcodeproj`；生成结果一并提交，用户无需安装 XcodeGen 即可打开。
**理由**：手写 pbxproj 易错且难调试；XcodeGen 的 yml 可读、可重生成，能干净地接入本地 Swift Package 与测试 target。提交生成产物保证用户零依赖打开。
**备选**：①手写 pbxproj（Xcode 16+ 的 synchronized groups 让其可行，但仍更脆）；②Tuist（未安装）；③ruby xcodeproj gem（未安装）。

## D2 — 总体架构：双层（Core 包 + App）（2026-06-20）
**决策**：
- `RewardCore`（Swift Package，纯 Foundation，无 UI/SwiftData）：领域模型(值类型) + 业务规则引擎（计分/徽章/连击/兑换资格/趋势）+ 示例数据。用 `swift test` 跑（macOS host，快、稳，作为 TDD 主战场）。
- `RewardingSystem`（iOS App，SwiftUI + SwiftData）：持久化(@Model)、角色权限、视图。依赖 RewardCore。
**理由**：把**业务规则**与**持久化/UI**解耦——规则纯函数化可被快速/确定性单测覆盖（满足"核心逻辑有测试覆盖"+TDD）；SwiftData/@Query 在 App 层保持惯用法。便于未来扩展多孩子。
**备选**：全部塞进单一 App target（测试只能跑模拟器，较慢；耦合更高）。

## D3 — 持久化：SwiftData（2026-06-20）
**决策**：App 层用 **SwiftData**（iOS 17+）。@Model 为单一事实来源，视图用 @Query。业务计算把简单值喂给 RewardCore 纯函数。
**理由**：用户推荐 SwiftData/Core Data；SwiftData 是现代惯用法、与 SwiftUI 集成好、样板少。Xcode 26 完整支持。
**备选**：Core Data（更老、样板多）；Codable+JSON 文件（最简单但放弃了查询/关系能力）。

## D4 — 部署目标 iOS 17.0、Universal（2026-06-20）
**决策**：Deployment target **iOS 17.0**；`TARGETED_DEVICE_FAMILY = 1,2`（iPhone+iPad universal）；两端统一 **TabView + NavigationStack**，内容用 `LazyVGrid(.adaptive)` 自适应铺满 iPad 宽屏。
**理由**：iOS 17 是 SwiftData 的下限，兼顾设备覆盖；TabView 在 iPhone/iPad 上都稳健、惯用，配合自适应网格已满足"适配两种屏幕"，比 NavigationSplitView 更省心、MVP 风险更低。
**备选**：iPad 用 NavigationSplitView（更贴 iPad 习惯，列为后续增强，非 MVP 必需）；iOS 18/26（更新 API 但缩小设备覆盖）。
**修正(2026-06-20)**：初版 D4 曾写"iPad 用 NavigationSplitView"，实际实现统一为 TabView+自适应网格——此处已据实更正（代码评审发现文档/代码不一致）。

## D5 — 测试框架：XCTest（2026-06-20）
**决策**：RewardCore 与 App 测试都用 **XCTest**。
**理由**：CLI(`swift test` / `xcodebuild test`)下最稳、零意外，保证自主 loop 不被框架坑卡住。
**备选**：Swift Testing（Xcode 26 支持、语法更现代）——作为未来可选升级，MVP 阶段不引入风险。

## D6 — 角色门禁：PIN 为主 + 生物识别可选（2026-06-20）
**决策**：家长入口用 **4 位 PIN**（首次启动设置，示例数据默认 `1234`，家长设置内可改）为唯一真值；**Face ID/Touch ID 作为可选快捷解锁**（LocalAuthentication），不可用或失败时回退 PIN。PIN 以 salted SHA-256 存 Keychain。
**理由**：PIN 在模拟器与所有设备上 100% 可用、无需生物识别录入即可演示；生物识别作锦上添花。满足"防止孩子自己切成家长"。
**备选**：纯 Face ID（模拟器/未录入设备不可用，演示受阻）。

## D7 — 数据模型为多孩子预留（2026-06-20）
**决策**：所有业务实体带 `childID: UUID` 字段；MVP 只 seed 一个 ChildProfile，全部数据挂其 id。UI 不暴露多孩子管理。
**理由**：满足"第一版只管一个孩子，但数据结构为将来扩展留余地"。未来加多孩子只需放开 UI + 按 childID 过滤。

## D8 — 撤销与流水完整性：软删除（2026-06-20）
**决策**：记分流水(ScoreEvent)支持**软删除**(`isVoided`)；"撤销最近一次"将最近一条未作废事件置 isVoided=true。总分/列表/趋势一律排除已作废。
**理由**：保留审计与趋势完整性；撤销可控、可解释。
**备选**：硬删除（更简单但丢历史）。

## D9 — 徽章/游戏化派生而非持久化（2026-06-20）
**决策**：徽章/连击/里程碑由 **BadgeEngine 从历史实时派生**，不单独落库。
**理由**：避免"状态与历史不同步"类 bug；规则集中、易测。
**备选**：落库 EarnedBadge（需维护一致性，MVP 不必要）。

## D10 — UI 语言：简体中文（2026-06-20）
**决策**：UI 文案用**简体中文**（用户与孩子均中文）；字符串集中管理便于未来本地化。
**理由**：目标用户为中文家庭，孩子端"少文字、友好"。
**备选**：英文 / 多语言（MVP 不必要）。

## D11 — 积分/徽章默认值（2026-06-20）
**决策**（示例数据，家长可改）：
- 类别：学习 / 生活 / 品德 / 其他。
- 里程碑徽章阈值（累计总分）：50 / 100 / 200 / 500。
- 连击(streak)：连续天数中"当天净得分>0"即算 1 天。
- 本周目标：默认每周 100 分（进度条）。
**理由**：ABA 代币经济正向激励为主；阈值循序渐进，给孩子可见的近期目标。

## D12 — 孩子头像用 SF Symbol 而非 emoji（2026-06-20）
**决策**：ChildProfile.avatarSymbol 存 **SF Symbol 名**（示例 `teddybear.fill`），渲染用 `Image(systemName:)`。
**理由**：模拟器实测部分较新 emoji（如 🦊 U+1F98A）在大号 Text 下渲染为缺字符方框；SF Symbol 跨设备/系统稳定渲染，且与全局图标风格一致。
**备选**：emoji 头像（更俏皮但渲染不稳）。

## D13 — 两阶段代码评审后的修正（2026-06-20）
**决策**：依据两位独立评审（correctness/security + architecture）反馈，**无 Critical**，已落地以下修正：
1. **削减 RewardRepository 死代码**：移除视图/测试均未用的 8 个只读派生方法（weeklyNet/dailyTrend/streak/earnedBadges/nextMilestone/cumulativeEarned/affordableRewards/activeRewards）；明确 repo 只负责 mutation + 极少测试所需派生，读路径统一走"@Query + 引擎/ScoreSummary"（唯 @Query 能驱动 SwiftUI 刷新）。
2. **抽出 IconGridPicker**：规则/奖励编辑共用图标网格，消除重复。
3. **兑换审批清晰化**：PendingApprovalsList 接收 balance，积分不足时禁用"通过"并红字标注"需X余Y"（审批时仍二次校验余额，双保险）。
4. **PIN 防爆破**：连续输错 5 次锁定键盘 30 秒（ParentGateView）。
5. **记分横幅计时**：由 DispatchQueue token 改为 `.task(id:)` 可取消计时，修正快速连点下的早消失。
6. **DEBUG 门控**：UITEST_TAB/UITEST_GATE 截图钩子用 `#if DEBUG` 包裹，发布版恒为默认。
**已知后续（非 MVP 阻塞）**：
- 视图层 @Query 暂未按 childID 过滤（当前单孩子无影响）；扩展多孩子时需在 @Query 加 `#Predicate { $0.childID == 当前 }` 或改走 repo 过滤投影。
- 默认演示 PIN=1234；真机使用建议首次进入家长端后在「设置」改 PIN。
- 角色门禁端到端：已加 XCUITest（见 D14），不再依赖人工截图。
**理由**：评审意见均为合理改进（去重/澄清/加固），无伤筋动骨重构；保持 MVP 范围。

## D14 — 角色门禁端到端 XCUITest（2026-06-20）
**决策**：新增 UI 测试 target `RewardingSystemUITests`（`UITests/RoleGateUITests.swift`，4 例），端到端验证门禁：①默认孩子端只读、家长「记分」Tab 不可见；②正确 PIN(1234) 进入家长端；③错误 PIN 不解锁；④取消回到孩子端。
**实现**：App 加 `#if DEBUG` 的 `UITEST_RESET` 环境变量强制已知 PIN，保证不受历史 Keychain 影响；关键控件加 accessibilityIdentifier（`parentLockButton`、`pinKey-*`）。`xcodebuild test` 全绿（4 UI + 15 单测 + 39 领域 = 58）。
**理由**：角色区分是 brief 的「关键」需求，端到端自动化把"门禁阻断 + 解锁"从人工截图升级为可回归的断言。这条把 D13 的"后续可加 XCUITest"落地。

## D15 — 修复角色切换的呈现态竞态（iPad 偶发崩溃）（2026-06-21）
**现象**：用户在 iPad 用 Xcode 跑 UI 测试，`testCorrectPINUnlocksParent` 偶发 "Test crashed"（应用崩溃，非断言失败）。CLI 上单跑/整类/6 次迭代均无法复现（9/9 通过）→ 低频竞态，iPad 居中 form-sheet + Xcode 调试器时序下更易触发。
**根因**：`ParentGateView.verify()` 成功分支在同一帧内做了三件冲突的事——`role.unlockParent()` 翻转角色导致 `RootView` 把 sheet 宿主从 `ChildTabView` 换成 `ParentTabView`，同时 `onSuccess()`(showingGate=false) 与 `dismiss()` 双重关闭弹窗。"切换宿主视图树 + 双重 dismiss" 在弹窗仍呈现时同帧发生 → SwiftUI 呈现态竞态偶发崩溃。
**修复**：把"校验"和"切换角色"解耦——
- `RoleManager` 拆出 `verify(pin:)` / `authenticateBiometrics()`（只校验）与 `enterParent()`（只切换）；`unlockParent` 保留=verify+enterParent（单测/DEBUG 钩子用）。
- `ParentGateView` 校验通过只调 `onAuthenticated()`，不再翻角色、不再自己 `dismiss()`。
- `RootView` 用 `.sheet(onDismiss:)`：通过后先 `showingGate=false` 关闭门禁，**待弹窗完全 dismiss 后**再在 onDismiss 里 `enterParent()`。单一关闭路径、宿主切换发生在弹窗消失之后，竞态消除。
- 同款竞态在"退出家长模式"路径（`ParentSettingsView` 翻角色+关设置弹窗同帧，且切回 child 会移除拥有该弹窗的 `ParentDashboardView`）一并按"先关弹窗、onDismiss 后再 switchToChild"修复（defense in depth）。
**验证**：iPhone 17 Pro 全套(15 单测+4 UI)绿；iPad (A16) UI 整类 ×3 迭代全绿（correct-PIN 3/3）+ 复跑全绿。
**诚实备注**：原始崩溃未能在 CLI 确定性复现，但已定位并移除崩溃路径上的真实结构性竞态，且该路径在 iPad 多次复跑稳定。

## D16 — 数据版本迁移 + 备份体系（2026-06-21）
**诉求**：版本迭代必须前后兼容数据、历史记录不丢（用户强调数据丢失影响极大）。
**决策**：三层保护 +"绝不破坏数据"原则——
1. **版本化 Schema + 迁移计划**（`SchemaVersions.swift`：`RewardSchemaV1` + `RewardMigrationPlan`）；容器经 `PersistenceController.makeContainer()` 带迁移计划打开，旧库自动迁移。以后改 @Model 必须新增 `RewardSchemaVN` + `MigrationStage`（手册见 `MIGRATIONS.md`）。
2. **打开/迁移前自动备份库文件**（`DataBackup.backupStoreFiles`，复制 .store/-wal/-shm，留最近若干份）。
3. **每次启动导出 JSON 快照**到 `Documents/Backups/`（`writeJSONSnapshot`，用 RewardCore 的 Codable 域类型，版本无关、人类可读）；`UIFileSharingEnabled`+`LSSupportsOpeningDocumentsInPlace` 让其在「文件」App 可见；家长设置可「立即备份 / 恢复最近备份」。
4. **失败不破坏数据**：`PersistenceController` 打开失败时宁可 fatalError 也不删库重建。
5. **JSON 用默认日期策略（数值全精度）** 而非 iso8601，保证恢复时时间戳完全无损。
**测试**：`PersistenceMigrationTests`——①写数据→关容器→带迁移计划重开，历史完整（核心承诺）；②迁移计划含当前 schema；③备份编解码无损；④导出→导入还原全量。运行时已验证启动自动写出 JSON 快照。
**已知后续**：跨设备 iCloud 同步（CloudKit）未做，仍属本机离线；多版本真实迁移待首个 V2 落地时按手册补 custom/lightweight stage + 迁移测试。
**理由**：迁移计划是"版本兼容"的正解；JSON 快照 + 库文件备份是"绝不丢数据"的安全网，两者独立、互为兜底。

## D17 — 头像上传 + 规则描述 + 分数直接输入（2026-06-21）
**需求**：①头像上传/修改（孩子+家长都可）；②规则加描述（≤200字）；③规则分值改为可直接输入。
**决策**：
1. **头像上传**：用 `PhotosPicker`（PHPicker，无需相册权限）选图 → `AvatarStore` 中心裁剪缩放到 512² 存 `Documents/Avatars/<childID>-<ts>.jpg`，`avatarSymbol` 存 `"file:..."` 标记（带时间戳确保变化触发刷新，旧文件自动清理）。`AvatarView` 解析顺序：上传照片 → 资源图(ChildAvatar) → SF Symbol（文件丢失则回退默认头像）。孩子端点头像、家长设置都可改（满足"两者都有权限"）。头像文件在 Documents，**随覆盖安装保留**。无 schema 变更。
2. **规则描述**：`BehaviorRule/RuleModel` 加**可选** `details: String?`（≤200，编辑页实时计数截断），规则列表显示。可选字段=最安全的轻量迁移。
3. **分数直接输入**：`RuleEditView` 分值由 Stepper 改为 `TextField(.number)` 直接输入 + 保留 ± 微调，范围放宽到 1…9999。
**迁移安全（重点回应用户"数据不能丢"）**：`details` 是新增可选字段 → SwiftData 自动轻量迁移。**实测**：把 iPad(A16) 模拟器里"旧版(无 details)"的库用"新版"覆盖安装并启动——未崩溃、孩子 小明 与 9 条规则**原样保留（首条规则 id 完全一致，证明是迁移而非重建）**、details 默认 nil。另加单测：旧备份(无 details)向后兼容解码、规则 details 增改、setAvatar 持久化。
**理由**：可选字段 + 文件型头像把两项新功能的数据风险降到最低（一个走自动轻量迁移、一个根本不碰 schema），且都已实测/单测验证不丢历史。

## D18 — 英文本地化（海外区）（2026-06-23）
**目标**：海外区上架需英文。一套代码、中英双语（zh-Hans 为开发/源语言）。
**机制**：
1. **String Catalog**（`App/Localizable.xcstrings`）。用 `xcstringstool sync` 从编译产物 `.stringsdata` 抽取所有 `LocalizedStringKey` 字面量（含插值的精确格式 `%lld`/`%@`/`%1$lld` 等）——比手写 key 可靠（CLI 下 xcodebuild 不会自动回写 catalog，故用 sync）。
2. **复用组件改类型**：`SectionCard.title`/`StatTile.title`/`EmptyHint.text` 由 `String` 改 `LocalizedStringKey`，否则 `Text(String)` 不本地化。
3. **领域字符串**（类别/状态/徽章名）：RewardCore 保持中文不动（其字符串即 key），App 侧 `DomainLocalization.swift` 用 `String(localized:)` 以中文为 key 查译文（`category.localizedName` 等），翻译集中在 App catalog。RewardCore 测试不受影响。
4. **示例数据**：`seedSampleDataIfNeeded` 在落库前用 `loc()` 本地化规则/奖励名与默认孩子名（默认名由真人名改为通用 `宝贝`/"My Child"，避免公开版预置真人名）。
5. **App 名**：`App/InfoPlist.xcstrings` 本地化 `CFBundleDisplayName`：zh="行为奖励"，en="**Reward Stars**"（占位品牌名，可改）。
6. **UI 测试**：`RoleGateUITests` 用 `-AppleLanguages (zh-Hans)` 固定中文，使其对中文文案的查询不受模拟器语言影响。
**验证**：英文/中文双语逐屏截图（孩子端、规则页、设置）；164 个 catalog key 全译；25 单测 + 4 UI 测试全绿。
**已知后续**：①英文文案/品牌名（Reward Stars）可再润色；②`BiometricAuth` 的"生物识别"兜底文案未本地化（仅无生物识别设备时出现）；③其余语言可后续加。

## D19 — 确定英文品牌名：保留 "Reward Stars"（2026-06-23）
**背景**：D18 把 en `CFBundleDisplayName` 设为占位 "Reward Stars"，待定。本次 resume 拍板。
**调研（web sanity check，非权威）**：儿童奖励/代币经济类目竞争激烈，"Star / Reward Chart" 同质名极多（Star Reward Charts、Reward Charts by Stellar、Stars | Child Reward Tracker、Reward Chart & Goals Tracker 等）；候选 **Kudos Kids 已被占用**。"Reward Stars" 精确名未见同名上架 App（疑似可用）；Bravo Stars / Tally Stars 亦疑似可用；Star Jar 有同名实体产品（风险中）。
**决策**：**保留 "Reward Stars"**（en）/ "行为奖励"（zh）。理由：对非母语用户清晰、与插画星星图标一致、**零改动**、精确名疑似可用；代价是通用、淹没在同类名中（对 ¥1 口碑型小众 App 影响小）。
**落地**：无需改文件——`App/InfoPlist.xcstrings:7`（en）与 `App/Localizable.xcstrings:58`（隐私句）已是该名；中文不动。
**待确认（用户侧，权威性在此）**：App Store Connect 的名称预留才具权威性。上传时若 "Reward Stars" 被占，备选顺序 **Bravo Stars → Tally Stars**。

## D20 — 采用多期自治开发宪章（loop engineering mode）（2026-06-23）
**背景**：用户要求"recover to loop engineering mode 并严格遵循 CLAUDE.md"。本仓原本无 CLAUDE.md；用户提供其 financial_assistant 项目的《多期自治开发宪章》，要求移植进本项目。
**决策**：将 `CLAUDE.md` 升级为本项目的多期自治宪章（§0 开工必读教训库 / §1 Superpowers 全流程 / §2 纯 loop 自主决策 / §3 每期收尾：成本核算+自进化 / §4 项目坐标 / §5 教训库），并建配套 `PHASES.md`、`COST_LOG.md`、`.learnings/`。
**改写（非照搬）**：
1. §4 用本项目坐标替换 finance 坐标（两层 RewardCore/App、命令、不变量）。
2. §2「物理必须用户提供」清单改为本项目实际：Apple 账号 / App Store Connect / 真机签名 / 真实孩子数据 / 中国区备案 / 名称预留；本项目无密钥后端故无 `.env`。
3. §5 教训移植 financial_assistant 的通用条目（同栈适用），**逐条标注「移植/本项目已发生」provenance**，不谎称未发生的事在本项目发生过；其中**隐私(1)、xcodegen(7)** 本项目确有实例，**locale 数字解析(8)** 按用户明确要求纳入并绑定到本项目的"分数直接输入"(D17)。
4. 期号映射本项目 git 历史：Phase1=MVP、Phase2=迁移+上架 part1+英文化、Phase3=上架准备(当前)。
**理由**：本项目与 financial_assistant 同栈（Swift/SwiftUI/SwiftData/xcodegen/Superpowers），宪章工作法可直接复用；自治模式契合"上架准备多为机械/低风险打磨"。
**行为变化**：自此**不再就 spec/plan 逐项停下要确认**，自主决策+写 DECISIONS；仅顶部物理清单项停下汇总到 SETUP.md。
**待确认/边界**：autonomous ≠ 不可逆操作免确认——提交/推送、公开外发、删改非自建产物仍按既有谨慎；git 提交仍按"用户要求才提交、main 上先开分支"。

## D21 — 隐私政策托管方式（A4）+ 仓库历史风险（2026-06-23）
**决策**：隐私页用**独立的干净公开仓库 + GitHub Pages** 托管（待发布文件 `docs/privacy-page/index.html`，中英双语自包含），**不对本 App 仓库开 Pages**。
**理由（§5#1 隐私）**：免费账号 Pages 需公开仓库，而本仓 git 历史含真实孩子照片 `assets-src/20260621-150859.jpeg` → 对本仓开 Pages 会公开该历史。独立干净仓库规避。
**联系邮箱**：留占位 `<联系邮箱>` 由用户填，**不自动填其主邮箱**（避免在公开文档发布 PII）；建议用专设支持邮箱。
**顺带**：修正 `PRIVACY.md` en 品牌名 `RewardingSystem`→`Reward Stars`（与 D19 一致）。
**物理阻塞**：A4 仍需用户亲自托管 + 填邮箱 + 把 URL 填进 App Store Connect；步骤已写入 SETUP.md §8。

## D22 — 代码公开发布：全新历史重建（2026-06-24）
**背景**：用户暂停 App Store 上架（不想付 $99），改为把代码**公开**发布到自己的 GitHub。
**决策**：用**「全新历史」**方式公开——丢弃旧 git 历史，以**单个干净初始提交**重建仓库再推。这样彻底规避 D21 担忧（旧历史含真实孩子照片 `assets-src/*`）：公开仓库零照片、零旧历史、零真名。
**清理动作**：① 删除 `assets-src/`（2 张真实照片，未被 build/代码引用）并 gitignore；② 从**当前文件**去除真实孩子名——`AppTests/PersistenceMigrationTests.swift` 测试夹具改 `小明`、`DECISIONS.md` 两处改写为通用表述；③ orphan 分支单提交为新 `main`，删除全部旧分支，`reflog expire`+`gc --prune=now` 清本地旧对象。
**安全网**：重建前 `git bundle create --all` 全量备份到 scratchpad（**不推送**），可随时恢复旧历史/照片。
**保留**：`docs/appstore/screenshots/` 的 20 张为 SampleData（无真实数据），照常公开。
**备选（未采）**：私有仓库（最省事但用户要公开）、公开+filter-repo 清史（保留逐次提交但更复杂、历史仍可能残留）。

## D23 — Phase 4 迁移 Web/PWA：技术栈（2026-07-02）
**背景**：用户 /goal——无开发者账号致免费签名 7 天过期、原生 App 无法长期稳定用；迁 Web/PWA，保留产品逻辑/数据结构/页面流程/业务模型，换 Web UI + 云数据库 + 多人共享；Vercel/CF Pages + Supabase/Firebase + 自定义域名 + Safari 加主屏。
**决策**：
1. **前端 = Vite + React 18 + TypeScript 纯 SPA**（新目录 `web/`，与 iOS 工程同仓共存、iOS 侧冻结不动）。无 SSR 需求（应用在登录后、无 SEO），纯静态产物 Vercel/CF Pages 都零配置。**Tailwind CSS** 快速复刻 Theme；**React Router**；**vite-plugin-pwa** 出 manifest+SW（Safari 加主屏）；**vitest** 承接领域单测（对位 `swift test`）。
2. **数据库 = Supabase（Postgres + RLS + Realtime）**，非 Firebase。理由：用户目标"保留现有数据结构"——现模型是关系型（Child/Rule/ScoreEvent/Reward/Redemption + childID 外键 + 快照列），Postgres 1:1 平移；Firestore 文档模型要重建模，违背目标。RLS 表达家庭隔离比 Firestore rules 直观；开源可迁出。
3. **部署首选 Vercel**（Vite 零配置），CF Pages 步骤同文档并列；自定义域名在平台面板绑定（用户物理项）。
**备选（未采）**：Next.js（重、SSR 无用）、SvelteKit（生态小）、Firebase（重建模+锁定）。
**环境事实**：本机无 docker/supabase CLI → 云端行为无法本地实测，见 D25 的抽象层对策。

## D24 — 家庭共享与角色模型（Web 版）（2026-07-02）
**决策**：**一个家庭 = 一个 Supabase 账号**（email+密码）。登录即家庭空间；全部业务行带 `family_id`（RLS 按 `auth.uid()` 隔离）+ 沿用 `child_id`。**家长/孩子角色完全沿用 iOS 业务模型**：任何已登录设备默认孩子（只读）视图，家长功能靠 **4 位 PIN**（盐+SHA-256，哈希存云端随家庭同步）解锁，5 错锁 30 秒照旧。孩子设备长期保持登录、停留孩子模式 → 多端共享达成。
**理由**：完整保留既有角色/PIN 业务模型；避免给孩子建账号（未成年人合规负担）；一账号多设备即"家庭共享"，无需邀请/成员管理的复杂度（MVP）。
**备选（未采）**：每成员一账号+family 成员表（复杂，D 期再说）、匿名登录（数据易丢）。
**安全模型（明示，2026-07-03 评审确认）**：孩子设备共享家庭的已认证会话 → 家长/孩子之分是**纯客户端软防护**（懂技术的孩子理论上可经 REST 读到 `pin_blob` 离线爆破 4 位 PIN，或直接写数据）。这与 iOS 版"同一台设备上的 PIN 门禁"威胁模型一致（防的是孩子日常误触/偷改，不防懂逆向的攻击者），**接受**；若将来要硬隔离 → 升级为每成员一账号 + 角色列 + RLS 按角色限写。

## D25 — 存储抽象层：云未接线也可全量验证（2026-07-02）
**决策**：TS 定义 `RewardRepository` 接口（1:1 对位 iOS `RewardRepository` 的 mutation/query 语义：快照、软删除 isVoided、childID、seed/reset），两个适配器：
1. **LocalAdapter**（localStorage，带版本号 JSON）——无任何账号/env 即完整可用（演示与开发模式），全部业务流可本地端到端验证；
2. **SupabaseAdapter**——同接口；SQL 迁移 + RLS 策略随仓提交（`web/supabase/migrations/`），单测用 mock 客户端验 SQL 调用形状。
App 启动时有 `VITE_SUPABASE_URL/ANON_KEY` 则走云，否则走本地演示模式。
**理由**：宪章 §2（物理项不停下，占位跑通）+ 本机无 docker（D23）。**边界诚实**：RLS/Realtime 的真实行为在用户建好 Supabase 项目前标【未验证·待云端接线】，接线步骤进 SETUP.md。
**备选（未采）**：只写云适配器（无账号则全程不可验证，违反完成铁律）、IndexedDB/Dexie（本项目数据量小，localStorage 够用且零依赖）。
