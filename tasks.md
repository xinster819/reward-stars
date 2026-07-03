# Reward Stars — Tasks

> 配合 [HANDOFF.md](HANDOFF.md) 使用。每条：[ ] 描述 + 完成判据 + 依赖。

## E. Phase 4 — Web/PWA 迁移（2026-07-02 用户 /goal，D23–D25）
- [x] 领域层 RewardCore → TypeScript 移植（`web/src/domain/`）
      判据：✅ vitest 39+ 条对位测试全绿（引擎算法/边界/比较符 1:1，`pnpm test` 53/53）。
- [x] 数据层：纯函数 mutations + LocalRepo(localStorage) + SupabaseRepo（同接口，D25）
      判据：✅ 14 条仓库语义测试绿（快照/软删除/审批余额闸/seed 幂等/跨实例持久化/PIN）。
- [x] Supabase schema + RLS + 服务端审批 RPC（`web/supabase/migrations/0001_init.sql`）
      判据：SQL 已备好可整段执行。⚠️ 云端真实行为【未验证·待用户接线】。
- [x] UI 13 屏复刻（孩子 3 + 家长 5 + 门禁/引导/设置/编辑/备注模态）+ 双语 + PWA(manifest/SW/图标)
      判据：✅ `pnpm build` 绿；dev server 端到端手动走通：引导→孩子端→PIN 门禁（含错误 PIN/锁定逻辑）→记分→撤销→兑换→审批→余额正确；中英切换、移动端视口、控制台零错误、localStorage 持久化均验证。
- [x] 两阶段 review 修正
      判据：✅ 评审 22 条发现全部处置：2 critical（云端 childID 全局主键冲突→每家庭随机 UUID+随数据追踪；云导入无事务→`import_bundle` RPC 单事务）、7 important（审批家庭级锁、realtime 通道 dispose、首拉失败重试页防误走引导、同步错误横幅、generation 防竞态、PIN 锁定墙钟持久化、DELETE 通知盲区 touched_at+focus 校准）、13 suggestions（DST 重归一化、跨午夜 day-tick、事件排序、损坏数据备份、安全模型落 D24 等）。修后 `pnpm test` 53/53 绿、build 绿、预览端到端复验（引导/门禁锁定跨弹窗持久/解锁）通过。
- [x] Supabase 建项目 + 跑 SQL + 关 Confirm email（用户完成，2026-07-03）；本地 `.env.local` 已配置（项目 `znxqlxxrqtajlaefiwnw`）。
- [x] **云端全链路实测（2026-07-03，dev server 连真实 Supabase）**
      判据：✅ 注册即登录（auto-confirm）→ 云端 seed（1 孩子/9 规则/5 奖励，REST 直查确认落库）→ PIN blob 上云（64 字符）+ 门禁解锁 → 记分快照行入库 → 兑换 pending → **审批 RPC 实测**（服务端置 approved+decided_at，余额 30−20=10）→ **Realtime 跨设备同步实测**（REST 模拟另一设备插入 +5，页面 5 秒内自动 10→15）→ **RLS 隔离实测**（family2 读不到 family1、跨家庭写入 42501 拒绝）。测试账号：`xinster819+family@gmail.com`（可当真实家庭用或在 Auth→Users 删除；`+e2etest/+e2etest2` 为未确认残留可删）。
- [ ] （用户 ⛔）commit+push 授权 → Vercel 部署（Root=`web`，两个 env）→（可选）自定义域名 → 全家 Safari 加主屏。见 SETUP.md §10 B–D。
- [ ] 遗留小项：iOS 备份 JSON 导入 Web 用真实备份文件实测（兼容层已写）；撤销/清零的跨端传播已覆盖同类路径（UPDATE/touched_at）未逐一实测。

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
      ✅ 联系邮箱已填（`xinster819ca@gmail.com`；App 内「家长设置→关于→联系我们」同此，`AppConfig.contactEmail`）。已备：发布用 `docs/privacy-page/index.html`（双语，邮箱已填）+ GitHub Pages 步骤 SETUP.md §8（仍建议独立仓库；注：本仓历史已重建干净，"历史含照片"不再成立，§8 已于 2026-07-02 更新）。**只剩用户托管取 URL**。依赖：用户
- [x] 2026-07-02 基线复验（历史重建后首次全量门禁）：RewardCore 39 / App 单测 36 / UI 8 全绿，对象库无照片残留；SETUP.md 清扫 + 新增 §9 物理项清单。代码冻结中，物理项清单见 SETUP.md §9。
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
