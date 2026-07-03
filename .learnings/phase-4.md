# .learnings/phase-4.md — Phase 4（Web/PWA 迁移）实时踩坑记录

> 配合 [CLAUDE.md](CLAUDE.md) §0/§3。本期发现实时记在这；期末归纳进 `.learnings/retro-4.md`。

## 环境事实（2026-07-02 实测）
- Node v25.9.0 / npm 11.12.1 / pnpm 10.33.0 ✅；**docker、supabase CLI 不存在** → Supabase 本地实例跑不了，云端行为只能"SQL/RLS 写好 + 单测 mock + 用户接线后真验"，凡未真连过的云行为一律标【未验证·待云端接线】。

## 观察 / 踩坑

- **pnpm 装依赖极慢（21 分钟）**：别干等，后台跑安装、并行写不依赖 node_modules 的源码/配置/SQL；等 `node_modules/.bin/<tool>` 出现再跑测试。
- **Vite 新脚手架 tsconfig 开了 `erasableSyntaxOnly`**：TS 构造器参数属性（`constructor(private x: T)`）直接报 TS1294 → 用显式字段声明+构造器赋值。
- **supabase-js 查询构造器是 PromiseLike 不是 Promise**：回调类型写 `PromiseLike<{error}>`，`await` 没问题但类型别写 `Promise`。
- **测试先行抓到真 bug**：`verifyPinBlob` 对非法 base64 会抛 `InvalidCharacterError`（`atob`）而不是返回 false——对位测试直接暴露，try/catch 归为验证失败。
- **iOS Codable 日期是「2001 纪元秒」数值**：Web↔iOS 备份互导必须做双格式日期兼容层（数值→`978307200000 + v*1000`）；且**未用真实 iOS 备份实测前不得声称"格式兼容"**（教训 #3 的实例，写文档时差点臆造）。
- **跨午夜的手动验证**：session 跨 00:00 后「连击=0」不是 bug——今天无事件净分 0 断连，领域语义正确；深夜手测时间敏感字段先想日界。
- **评审（component 级）抓到 2 个 critical 我自己没想到**：① 云端把 `SAMPLE_CHILD_ID` 常量当每家庭的 child 主键 → 全局 PK 第二个家庭必撞（本地单库没这问题，**"本地能跑"掩盖多租户约束**）；② 客户端分步 delete+insert 的"整体替换导入"在中途失败时把云数据删空——**跨请求无事务，替换式写操作必须下沉到服务端单事务 RPC**。
- **useSyncExternalStore 的隐形约定**：状态变化若不体现在快照引用上（如 PIN 存 storage、pinBlob 存字段），notify 了也不重渲染——**凡影响 UI 门控的状态都要 bump 快照引用**。重构删掉旧的强制重渲染 state 时，先问"新路径靠什么触发重渲染"。
- **UI 安全态（锁定/限流）别放组件 state**：弹窗关闭即卸载清零，5 错锁 30 秒两下点击就绕过；提为模块级 + 墙钟计算剩余。

## 2026-07-03 云端接线实测
- **Supabase 新版 publishable key（`sb_publishable_…`）可直接当 anon key 用**：REST/Auth/Realtime 全部实测可用（含 postgres_changes 订阅）。
- **GoTrue 拒收 `example.com` 等测试域邮箱**（"invalid"）；测试账号用自己邮箱的 `+alias` 最干净（确认邮件也只进自己收件箱）。
- **免费档内置 SMTP 限流极低（每小时个位数）**：第二次注册就 `email rate limit exceeded`。家庭自用场景把 **Confirm email 关掉**（注册零邮件）既是 UX 正解也避开限流。
- **"Confirm email 开启 + signUp"返回成功但无 session、UI 无任何反馈**——凡"成功但需异步动作"的 API 响应都要显式给用户提示（已修：检测 `!data.session` 给提示）。
- **测 UI 的脚本选择器教训**：Tab 按钮文本带 emoji，`textContent.trim() === 'Scoring'` 匹配失败导致"云端 events 为空"的假告警——先怀疑测试脚本，再怀疑被测系统（本次差点误判为写库 bug）。
- REST 直查（带页面 session token）是验证"UI 显示 ≠ 真落库"的利器：children/rules/rewards/pin_blob/events 逐表确认。

## 2026-07-03 大陆可达性判断失误（用户复盘，重要）
- ❌ 用户两次问"大陆能不能访问"，我答了"默认域名不稳"却把自定义域名当**事后备选**（先部署→实测→不行再买），结果移动网络果然打不开 `*.vercel.app`，多耽误一天等域名。
- ✅ 规则：**目标用户在中国大陆 → 自定义域名不是 fallback 而是前置必选项**，应在部署动工的同时就让用户去买域名（¥60/年 vs 一天延误，成本不对称）。凡"低成本对冲高概率风险"的项，并行做，不要串行等验证。
- 泛化：用户连续两次主动问同一个风险 = 该风险对用户是关键决策项，回答里必须给"现在就做的动作"，不能只给风险评级。

## 2026-07-03 iPad 数据迁移
- **"启动时写的备份" ≠ 最新数据**：JSON 快照只在 App 启动时落盘，最后一次使用期间的改动全在 SQLite WAL 里（本例晚 4 天、差 20 条流水）。迁移前**必须对比快照与 store/WAL 的 mtime**，不一致就直读数据库本体。
- **App 签名过期 ≠ 数据不可达**：`xcrun devicectl device copy from --domain-type appDataContainer` 能直接从沙盒拷文件（设备解锁+配对即可），不用复活 App。
- **SwiftData(Core Data) SQLite 直读要点**：表名 Z 前缀、UUID 存 16 字节 BLOB（hex 转 8-4-4-4-12）、日期存 2001-01-01 纪元秒（+978307200 转 Unix）、枚举存 raw 字符串；直接开 .store 文件 sqlite3 会自动合并 WAL。
- **python.org 的 macOS Python 默认没配 CA 证书**（urllib SSL 报 CERTIFICATE_VERIFY_FAILED）：网络请求换 curl，python 只做本地 JSON 加工。

