# .learnings/phase-3.md — Phase 3 实时踩坑记录

> 配合 [CLAUDE.md](CLAUDE.md) §0/§3。本期发现实时记在这；期末由 retrospective 子代理归纳进 `.learnings/retro-3.md`，通用规则追加进 CLAUDE.md §5。

## 观察 / 踩坑

- 交接文档 HEAD 漂移：HANDOFF.md 头部写 HEAD `4f17d97`，实际 resume 时 HEAD `2bd87b5`（交接 commit 本身）。文档里的 HEAD 引用天然易过期，别盲信，以 `git log` 为准。
- 仓库长期**无 CLAUDE.md**，但 handoff-resume 提示语引用「CLAUDE.md 宪法」→ 接手时困惑。本期已建 CLAUDE.md（先精简版 → 再升为多期自治宪章，D20）。教训：提示语引用的文件要么真实存在要么显式声明缺失。
- README 与 HANDOFF 的测试数量不一致（README 58 / HANDOFF 68）。CLAUDE.md 改为不硬编码总数、指向 HANDOFF，避免计数腐烂。
- A1「定品牌名」实为决策而非代码：占位即终名（保留 Reward Stars），零改动；可验证项是 App Store Connect 名称预留（用户侧，物理阻塞）。

## A2 onboarding 实施踩坑
- **Bash 复合命令里 `cd RewardCore && swift test` 会把 cwd 带到子目录并延续到下一次调用** → 紧接着的 `xcodebuild` 找不到 `RewardingSystem.xcodeproj`。教训：跨目录命令用绝对路径 / 用完 cd 回根（已在 CLAUDE/系统约定提示，实测踩到）。
- **xcstrings 手动合并**：`json.dumps(sort_keys=True)` 会按 Python Unicode 排序重排，与 Xcode 的 CJK locale 排序不同 → 784 行噪音 diff。正解：`object_pairs_hook=OrderedDict` 保序、新键追加到末尾、`ensure_ascii=False, indent=2`、**不写末尾换行**（原文件无）→ 仅 160 行纯新增 diff。
- **慢速 iOS 构建下的 TDD**：测试先写（满足"先测后码"），但当"实现缺失=必然编译失败"时跳过单独的"跑一次看红"步骤可省一个数分钟的 xcodebuild 周期；属 loop 模式效率裁量，已记录。
- **en 本地化验证**：用 `-AppleLanguages (en)` 的 UI 测试断言 "Welcome to Reward Stars" 取代易碎的人工截图核对（§5#3 离线确定性）。
- **两阶段 review 抓到 spec 自身的瑕疵**：spec 写"预填孩子名"，但 seed 的默认名是占位「宝贝/My Child」→ 预填后用户需先清空、UI 测试 typeText 变成追加、且"名字必填"形同虚设。修正：不预填、留占位、强制输入。教训：UI 输入字段"预填默认占位值"常与"必填"语义冲突；review 要对照真实 seed 数据而非 spec 字面。

## 引导改版 + PIN 限位调试
- **测试回归时，先核对所有变量——包括测试环境（destination/设备），不止代码。** 加 PIN 限位后两个 UI 测试挂了，我先怪 `.onChange` 还把正确代码改回去；实则是我把跑测 destination 从 `iPhone 17 Pro`（CLAUDE.md 规范机型）换成了 iPad。换回 iPhone 即过。系统化隔离单一变量前别动手改"嫌疑"代码。
- **iPad 模拟器下 XCUITest 往 `fullScreenCover` 内 Form 的 `SecureField` 打字不稳**（真机/真人正常）。对策：引导类 UI 测试以 iPhone 为准；iPad 行为靠人工/截图验证。
- **SecureField 限长**：`.onChange` 里改绑定值会扰动安全输入，故仅在"需截断时才写回"（`if s != new { … }`），合法输入零写回。`OnboardingSetup.sanitizedPIN`（仅数字、≤4）纯函数可单测；记分输入/PIN 等"定长数字键入"都该这么限。

## 2026-07-02 resume：历史重建后基线复验（代码冻结）
- 用户拍板本 session **代码冻结**，只验「全新历史」重建（D21/D22，HEAD=`fd12daf` 单提交）后的基线。全绿：RewardCore 39 / App 单测 36 / UI 8，0 失败；`git rev-list --objects --all` 复验对象库无 jpeg/assets-src 残留。
- **重建历史/大清理后要立刻补跑完整门禁**：重建理论上不动工作树，但"理论上"不算证据；本次是重建后首次全量验证（教训 #5 独立复验的延伸）。
- **一次性事件（清照片、填邮箱）做完后，要回头清扫所有引用它旧状态的文档**：SETUP.md §8 仍写"历史含照片""邮箱待填"，均已过时误导，本次修正；并新增 §9 上架物理项清单（宪章要求汇总到 SETUP.md，此前只散在 tasks.md）。
- HANDOFF 里的旧 commit 哈希（`1554c20` 等）在历史重建后全部失效，只能当叙事参考——再次印证"文档内易变事实不硬编码"。

## 本期待沉淀（候选规则，期末再筛进 §5）
- 文档内的易变事实（HEAD、测试计数）不硬编码，指向单一真相源。
- Bash 复合/连续调用的 cwd 漂移 → 一律绝对路径（可升为 §5 通用规则）。
- 生成式资源（String Catalog 等）手动改用保序 JSON 合并求"纯新增 diff"。
