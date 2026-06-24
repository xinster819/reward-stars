# Reward Stars — Tasks

> 配合 [HANDOFF.md](HANDOFF.md) 使用。每条：[ ] 描述 + 完成判据 + 依赖。

## A. 上架就绪（iOS，我能做）
- [x] 定英文品牌名：保留 `Reward Stars`（en）/`行为奖励`（zh）。见 DECISIONS D19。无需改文件（`InfoPlist.xcstrings:7` / `Localizable.xcstrings:58` 已是该名）。上传若被占→备选 Bravo Stars → Tally Stars。
      判据：App Store Connect 与图标下名称一致；中文仍"行为奖励"。依赖：无
- [x] 引导 / 首启 onboarding（「演示型」live 预览轮播可跳过 + 设孩子名/家长 PIN 必填；PIN 限 4 位；仅新装展示、升级跳过）
      判据：✅ 首启展示、中英双语、PIN 限位。已并入 `main`；tests 全绿（iPhone：RewardCore 39 / App 单测 36 / UI 7）。spec/plan 见 `docs/superpowers/`。依赖：无
- [x] 英文文案润色
      判据：✅ 176/180 translated（3 个为纯数字/标点格式串，无需译）；通读自然。本轮微调 2 处（Century→Centurion、On-time wake & sleep→Up & to bed on time），build 绿。依赖：无
- [x] App Store 代码侧上架准备（隐私清单 + 导出合规 + 提交指南）
      判据：✅ `App/PrivacyInfo.xcprivacy`（不追踪/不采集/仅 UserDefaults CA92.1）已独立复验进 **Release 包**；`ITSAppUsesNonExemptEncryption=NO` 已验进构建 Info.plist；`docs/appstore/SUBMISSION.md`（ASC 步骤 + 中英元数据草稿）。gate 全绿（RewardCore 39 / App 单测 36 / UI 8 / Release 构建成功）。提交 `81af87e`，已并入 `main`。依赖：无
- [x] 生成上架截图（iPhone 6.9" + iPad 13"，中英各一套）
      判据：✅ 20 张原生分辨率（1320×2868 / 2064×2752），5 屏（欢迎/孩子首页/商店/家长总览/规则）× 中英 × 两机型，全 SampleData 无真实数据。见 `docs/appstore/screenshots/`，可重生成 `docs/appstore/generate-screenshots.sh`。已视觉复验：总分 74、连击 7、趋势/最近记录非空、英文版示例名为英文。提交 `1554c20`，并入 `main`。**上传仍需用户账号**。依赖：无
- [ ] 托管 [PRIVACY.md](PRIVACY.md) 取 URL + 填联系邮箱 ⛔ 用户物理阻塞
      判据：公开可访问 URL；填入 App Store Connect「隐私政策网址」。
      ✅ 联系邮箱已填（`xinster819ca@gmail.com`；App 内「家长设置→关于→联系我们」同此，`AppConfig.contactEmail`）。已备：发布用 `docs/privacy-page/index.html`（双语，邮箱已填）+ GitHub Pages 步骤 SETUP.md §8（用干净独立仓库，勿用本仓——历史含真实照片，见 D21）。**只剩用户托管取 URL**。依赖：用户
- [ ] 决定是否装最新构建到 iPad（覆盖安装）
      判据：装后双语 + 插画图标生效、数据未丢、用户重传头像。依赖：用户拍板

## B. 用户侧（我做不了）
- [ ] 开发者账号 $99/年
      判据：账号可上传构建。依赖：无
- [ ] App Store Connect：截图 / 描述 / 最低价一次性付费
      判据：构建进入审核。依赖：A 全部 + B 账号
- [ ] 中国区：软著 + 工信部备案
      判据：备案号下发，可上中国大陆区。依赖：账号

## C. 调研落档【待确认】
- [ ] 是否落 RESEARCH.md（调研结论 + 出处 + 未决项）
      判据：你确认要不要。依赖：无
- [ ] 是否补查竞品定价 / 转化率（上轮未核实）
      判据：你确认要不要。依赖：无

## D. 后续增强（非上架阻塞）
- [ ] iCloud 同步（CloudKit）
      判据：换机数据自动同步。依赖：无
- [ ] 多孩子放开（数据已就绪，需 UI + `@Query` 按 childID 过滤）
      判据：可增删/切换多个孩子，数据互不串。依赖：无
- [x] git 历史清除真实照片 `assets-src/*`（公开化）
      判据：✅ 用「全新历史」重建仓库公开发布——单初始提交无旧历史、`assets-src/` 已删并 gitignore、真名已从代码/文档/提交信息去除。本地全量备份 bundle 已留存（未推送）。
