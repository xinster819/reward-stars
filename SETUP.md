# SETUP.md — 在你的 iPhone / iPad 上运行「行为奖励」

这份文档列出**你需要亲自做的全部事项**：用 Xcode 打开工程、配置签名、装到真机。代码侧已做到「模拟器可编译运行并通过测试」，真机这一步只差你的 Apple ID 与设备。

预计用时：5–10 分钟。

---

## 0. 前置条件

- 一台 **Mac**，安装 **Xcode 16 或更高**（本项目用 Xcode 26 开发）。首次打开 Xcode 会提示安装 iOS 组件，按提示装好。
- 一个 **Apple ID**（免费即可，不必付费开发者账号）。
- 你的 **iPhone / iPad**，用数据线连到 Mac（或同一 Apple ID + 网络下的无线调试）。

> 免费 Apple ID 可安装到自己的设备，但签名有效期 **7 天**，到期后重新连 Mac 用 Xcode 跑一次即可续签。付费开发者账号（$99/年）无此限制。

---

## 1. 打开工程（无需安装任何额外工具）

工程文件 `RewardingSystem.xcodeproj` 已经生成并随仓库提交，**直接打开即可**，不需要 XcodeGen：

```bash
open /Users/bytedance/Personal_Projects/RewardingSystem/RewardingSystem.xcodeproj
```

> 仅当你修改了 `project.yml` 或增删了源文件，才需要 `brew install xcodegen && xcodegen generate` 重新生成工程。

---

## 2. 先在模拟器跑一遍（可选，确认一切正常）

1. Xcode 顶部运行目标选 **任意 iPhone 或 iPad 模拟器**（如 iPhone 17 Pro）。
2. 按 **`Cmd + R`** 运行。**首次启动先出引导页**（预览轮播可跳过，孩子名 + 家长 PIN 必设），完成后进孩子端首页（总分、徽章…）。
3. 按 **`Cmd + U`** 跑测试，应全部通过。

---

## 3. 配置签名（关键，一次性）

1. 左侧选中蓝色工程 **RewardingSystem** → TARGETS 选 **RewardingSystem** → 顶部标签 **Signing & Capabilities**。
2. 勾选 **Automatically manage signing**。
3. **Team**：点下拉，选 **Add an Account…**，登录你的 Apple ID；登录后 Team 选你名字后面的 **(Personal Team)**。
4. **Bundle Identifier**：默认是 `com.rewardingsystem.app`。如果 Xcode 报红说该 ID 不可用/已被占用，改成**全球唯一**的，例如：
   ```
   com.<你的名字拼音>.rewardingsystem
   ```
   改完红字应消失，Xcode 会自动生成签名证书与描述文件。

> 如果想长期固定这个 Bundle ID，也可同步改 `project.yml` 里的 `PRODUCT_BUNDLE_IDENTIFIER`，避免下次重生成工程时被覆盖。

---

## 4. 装到 iPhone / iPad

1. 用数据线把设备连上 Mac。设备弹「信任此电脑？」选 **信任**，输入设备密码。
2. Xcode 顶部运行目标下拉里，选你的真机（设备名，而不是模拟器）。
   - 首次可能需要在设备「设置 → 隐私与安全性 → 开发者模式」打开 **开发者模式** 并重启设备。
3. 按 **`Cmd + R`**。Xcode 会编译并安装到设备。
4. **首次运行会因"未受信任的开发者"被拦**。在设备上：
   **设置 → 通用 → VPN与设备管理 → 开发者 App →** 点你的 Apple ID **→ 信任**。
5. 回到主屏幕点开 **行为奖励** 图标，即可使用。

iPad 同理（universal app，自动适配 iPad 布局）。

---

## 5. 首次使用须知

- App 默认进入**孩子（只读）**界面。点右上角 **🔒** 进入家长界面。
- **默认家长 PIN：`1234`**。进入家长界面后请到 **设置（右上齿轮）→ 修改家长 PIN** 改成你自己的，防止孩子猜到。
  - 连续输错 5 次会锁定数字键盘 30 秒。
  - 设备已录入 Face ID / Touch ID 时，门禁页会出现生物识别按钮，可一键解锁（失败自动回退 PIN）。
- 想恢复初始演示数据：家长 **设置 → 重置为示例数据**。

---

## 6. 常见问题

| 现象 | 处理 |
|---|---|
| Signing 报 "Failed to register bundle identifier" | Bundle ID 重名，改成唯一的（见第 3 步第 4 点）。 |
| 设备上点开 App 闪退/「不受信任的开发者」 | 去 设置 → 通用 → VPN与设备管理 信任你的开发者证书（第 4 步第 4 点）。 |
| 装上后约一周打不开 | 免费签名 7 天到期，连 Mac 用 Xcode 再 `Cmd+R` 跑一次续签。 |
| 选不到真机 / 灰色 | 打开设备「开发者模式」并重启；确认数据线/信任电脑。 |
| Face ID 不弹 | 模拟器需在「Features → Face ID → Enrolled」开启；真机需系统已录入生物识别。PIN 始终可用。 |
| 想换最低系统版本 | `project.yml` 里 `deploymentTarget.iOS` 改一行后 `xcodegen generate`（默认 iOS 17.0）。 |

---

## 7. 数据与隐私

- 全部数据（孩子、规则、积分流水、奖励、兑换）离线存于本机 SwiftData，**不上传任何服务器**。
- 家长 PIN 以「随机盐 + SHA-256」哈希存于 **Keychain**（`仅本机、解锁后可访问`），明文 PIN 不落盘。
- 删除 App 即清除全部本地数据。

---

## 8. 托管隐私政策、拿到公开 URL（App Store 上架需要 / 任务 A4）

App Store Connect 要求填一个**公开可访问的「隐私政策网址」**。用 GitHub Pages 免费托管，按下面做。

> 建议仍用一个**只放隐私页的独立公开仓库**（URL 干净、且不必公开整个 App 仓库）。
> 历史背景：本仓库 git 历史曾含真实孩子照片，**2026-06 已用「全新历史」重建为单初始提交并清理本地对象**（见 DECISIONS D21/D22，2026-07-02 复验对象库无残留）；如今对本仓库开 Pages 不再泄照片，但独立仓库仍是更省事的选择。

**待发布文件已备好**：`docs/privacy-page/index.html`（中英双语、自包含、移动端友好）。**联系邮箱已填好**（`xinster819ca@gmail.com`，与 App 内「家长设置 → 关于 → 联系我们」一致），直接上传即可，无需再改。

**步骤（网页版）**：
1. GitHub 新建一个 **public** 仓库，例如 `reward-stars-privacy`。
2. 把本仓库的 `docs/privacy-page/index.html` 上传到新仓库**根目录**（文件名保持 `index.html`，邮箱已填好无需改）。
3. 新仓库 **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**。
4. 等 1–2 分钟，页面 URL 形如：`https://<你的GitHub用户名>.github.io/reward-stars-privacy/`。打开确认能访问、中英文都在、邮箱已填。
5. 把该 URL 填到 App Store Connect →「App 隐私」/「隐私政策网址」。

**步骤（命令行，已装 `gh`）**：
```bash
mkdir reward-stars-privacy && cd reward-stars-privacy
cp /Users/bytedance/Personal_Projects/RewardingSystem/docs/privacy-page/index.html .
git init && git add index.html && git commit -m "privacy policy page"
gh repo create reward-stars-privacy --public --source=. --push
gh api -X POST repos/{owner}/reward-stars-privacy/pages -f 'source[branch]=main' -f 'source[path]=/'
# URL: https://<用户名>.github.io/reward-stars-privacy/
```

> 备选：也可用公开 **Gist** 或把 `PRIVACY.md` 作为 `index.md` 交给 Jekyll 渲染——但单文件 `index.html` + 独立仓库最省事、URL 最干净。

---

## 9. App Store 上架：只剩你能做的事（物理阻塞清单）

代码/资产侧已 100% 备好（截图 20 张 `docs/appstore/screenshots/`、隐私清单、导出合规、中英元数据草稿）。按顺序做：

1. **Apple 开发者账号**（$99/年）：https://developer.apple.com/programs/
2. **隐私政策 URL**：按上面 §8 托管，拿到公开 URL。
3. **App Store Connect 建 App + 上传构建 + 传截图 + 定价（一次性 ¥1/$0.99）**：逐步照 [docs/appstore/SUBMISSION.md](docs/appstore/SUBMISSION.md) 做，元数据中英草稿已在其中。
4. **（仅中国大陆区需要）软著 + 工信部 ICP 备案**：不上中国区可跳过，先发其他地区。
5. （可选）把最新构建**覆盖安装**到 iPad（绝不先卸载，见 HANDOFF「已知坑」），装后重传孩子头像。

---

## 10. Web/PWA 版上线（Phase 4，替代 App Store 路线）

> ✅ **已全部完成上线（2026-07-03）**：正式地址 **https://eduinspire.fun**（大陆移动网络实测可用）；
> 备用地址 https://reward-stars.vercel.app（大陆运营商可能拦截，海外/代理可用）。
> 架构：域名（腾讯云，年费 ¥10 起，无需备案）→ Vercel（托管，push main 自动部署）→ Supabase（数据库）。
> 全家使用：每台设备打开正式地址 → 登录同一家庭账号 → Safari 分享 → 添加到主屏幕。
> 下面 A–D 为当时的操作步骤，留作重建参考。
> 本地试跑：`cd web && pnpm install && pnpm dev` → 浏览器开 http://localhost:5173。

### A. Supabase（云数据库 + 账号，免费档足够）
1. https://supabase.com 注册 → **New project**（区域选离你近的，如 Singapore）。
2. 项目建好后：左侧 **SQL Editor** → New query → 把仓库里 [web/supabase/migrations/0001_init.sql](web/supabase/migrations/0001_init.sql) 全文粘贴 → **Run**（应显示 Success）。
3. 左侧 **Authentication → Sign In / Up**：确认 **Email** provider 已启用；建议关掉 "Confirm email"（家庭自用，省去收验证邮件）。
4. 左侧 **Project Settings → API**：复制 **Project URL** 和 **anon public key**，下一步要用。

### B. 部署到 Vercel（免费，推荐；CF Pages 同理）
1. 代码推到你的 GitHub 仓库（若尚未推送）。
2. https://vercel.com 用 GitHub 登录 → **Add New → Project** → 选本仓库。
3. **Root Directory 填 `web`**，Framework 自动识别 Vite，构建命令/输出默认即可。
4. **Environment Variables** 加两条（值来自 A4）：
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public key
5. **Deploy** → 得到 `https://xxx.vercel.app`。
   - CF Pages 备选：Workers & Pages → 连仓库，Root `web`，Build `pnpm build`，Output `dist`，同样填两个环境变量。

### C. 自定义域名（可选）
Vercel 项目 → **Settings → Domains** → 添加你的域名，按提示在域名商处加 CNAME 记录即可。

### D. 全家设备使用
1. 每台设备 Safari 打开站点 → 用**同一个**邮箱账号登录（首台设备注册即创建家庭空间）。
2. 首台设备走引导：设孩子名 + 家长 PIN（4 位）；其他设备登录后自动跳过引导。
3. Safari **分享 → 添加到主屏幕** → 图标像 App 一样打开（PWA）。
4. 孩子设备保持默认孩子界面（只读+申请兑换）；家长界面凭 PIN 解锁，PIN 全家同步。

### E. 每周积分周报邮件（可选）
每周一早上自动给家长邮箱发一封上一整周的孩子积分周报（Supabase Edge Function + pg_cron + Resend）。
完整步骤（密钥、Vault、部署、手动触发自测）见 **[web/supabase/functions/weekly-report/README.md](web/supabase/functions/weekly-report/README.md)**。要点：
1. 注册 [Resend](https://resend.com) 拿 API key（测试可用 `onboarding@resend.dev` 发件）。
2. 执行迁移 [web/supabase/migrations/0002_weekly_report.sql](web/supabase/migrations/0002_weekly_report.sql)（`supabase db push` 或 SQL Editor）。
3. `supabase secrets set` 设 `RESEND_API_KEY / CRON_SECRET / REPORT_TZ / APP_URL / REPORT_FROM`，并把 `project_url / anon_key / cron_secret` 写入 Vault。
4. `supabase functions deploy weekly-report`，然后 `curl` 手动触发自测（见 README）。
5. 家长可在 App「家长设置 → 通知 → 每周积分周报邮件」随时关闭。默认时区 UTC+8（周一 08:00）；不同则同时改 cron 表达式与 `REPORT_TZ`。

> ⚠️ 云端行为（RLS 隔离/多端实时同步/服务端余额复验/周报邮件定时）代码与 SQL 已备好，但**在你完成 A 之前无法实测**——接线后如遇问题把报错发回来即可。
> 旧 iOS App 的数据如需搬到 Web：iOS 端「家长设置 → 立即备份」导出 JSON（在「文件」App 的 Backups 目录）→ Web 端「家长设置 → 导入备份」。字段同构、日期格式兼容层已写，**但尚未用真实 iOS 备份文件实测**——如导入异常，把 JSON 文件发回来我修。
