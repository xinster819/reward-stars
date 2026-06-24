# App Store 提交指南（行为奖励 / Reward Stars）

> 我（Claude）**无法替你提交**：上传/提交需要你的**付费 Apple 开发者账号、签名 Team、App Store Connect 账户**。
> 以下把能自动化的都做好了，剩下是你在 Xcode / App Store Connect 里的点击操作。

## ✅ 代码侧已就绪（我已完成）
- 隐私清单 `App/PrivacyInfo.xcprivacy`：不追踪、不采集、仅声明 UserDefaults（CA92.1）——已实测打进 Release 包。
- 导出合规：`ITSAppUsesNonExemptEncryption = NO`（仅用豁免的 PIN 哈希）——免去每次上传的加密问询。
- App 图标 1024、版本 `1.0`(build 1)、双语显示名（行为奖励 / Reward Stars）、隐私政策页（A4，`docs/privacy-page/index.html`）。
- Release 构建通过；全测试绿（RewardCore 39 / App 单测 36 / UI 8）。

## ① 你的前置（物理阻塞）
1. **加入 Apple Developer Program**（$99/年）：<https://developer.apple.com/programs/>。
2. 在 Xcode 打开工程 → 选 `RewardingSystem` target → **Signing & Capabilities** → 勾 Automatically manage signing → 选你的 **Team**（付费团队，非 Personal）。Bundle ID 用 `com.rewardingsystem.app`（被占则改唯一值，并同步 `project.yml` 的 `PRODUCT_BUNDLE_IDENTIFIER` 后 `xcodegen generate`）。
   > 想固定 Team 可在 `project.yml` 填 `DEVELOPMENT_TEAM`（现为空），重生成工程。

## ② 在 App Store Connect 建 App
<https://appstoreconnect.apple.com> → My Apps → ＋ → New App：
- 平台 iOS；名称 **行为奖励**（主语言简体中文）；Bundle ID 选上面的；SKU 任意（如 `rewardingsystem-1`）。
- **类别建议：主「教育(Education)」**（次可选「生活(Lifestyle)」）。**不建议选「儿童(Kids)」类**——会触发更严合规（外链/购买需家长门、第三方分析限制等）；本 App 由家长操作、PIN 门禁，归 Education 更顺，审核负担小。
- **定价**：一次性买断，最低档（≈¥1 / $0.99）。无内购。
- **年龄分级**：填问卷 → 预计 **4+**（无暴力/成人内容）。

## ③ 隐私 / 合规（App 隐私问卷）
- **Data Collection：选「Data Not Collected」**（本 App 不采集任何数据）。
- **隐私政策网址**：填你托管的 URL（见 [SETUP.md](../../SETUP.md) §8 把 `docs/privacy-page/index.html` 部署到 GitHub Pages）。
- **支持网址（Support URL，必填，须是网页非 mailto）**：可复用隐私页同站 URL，或建个简单支持页。
- 导出合规：已在 Info.plist 声明 NO，上传时一般不再追问。

## ④ 截图（必需）—— ✅ 已生成
App Store Connect 至少需要：
- **iPhone 6.9"**（如 iPhone 16/17 Pro Max）一组；
- 因是 universal，**iPad 13"** 一组。
（其余尺寸可由这两组自适应，规则以 ASC 当时要求为准。）

**已按规范尺寸批量生成，中英各一套 5 屏**（欢迎 / 孩子端首页 / 商店 / 家长总览 / 规则），
见 [`screenshots/`](screenshots/)（`iphone-6.9/` = 1320×2868，`ipad-13/` = 2064×2752）。
全部为 `SampleData` 示例数据（无真实数据），可直接上传或后期加文案/设备框美化。
重新生成：`bash docs/appstore/generate-screenshots.sh`。

## ⑤ 归档上传
Xcode：顶部目标选 **Any iOS Device (arm64)** → 菜单 **Product → Archive** → Organizer 里 **Distribute App → App Store Connect → Upload**（自动签名）。或用 **Transporter** App 上传导出的 `.ipa`。

## ⑥ 填元数据 → 提交审核
把下面草稿粘进对应语言的版本，关联上传好的构建，点 **Submit for Review**。

---

## 元数据草稿（可直接用 / 再润色）

| 字段 | 简体中文 | English |
|---|---|---|
| 名称 (≤30) | 行为奖励 | Reward Stars |
| 副标题 (≤30) | 用星星培养好习惯 | Star rewards for good habits |
| 关键词 (≤100, 逗号无空格) | 奖励,积分,行为,习惯,孩子,家长,代币,贴纸,打卡,自律 | reward,chart,kids,behavior,habit,stars,chore,parenting,routine,token |
| 宣传文本 (≤170) | 用星星和奖励，把孩子的好行为变成看得见的进步。纯本地、不联网、保护隐私。 | Turn good behavior into visible progress with stars and rewards. Fully on-device and private. |

**描述（简体中文）**
```
「行为奖励」用「积分 + 奖励」帮家长引导孩子养成好习惯。

· 自定义奖惩规则，一键记分，可撤销
· 攒星兑换你设置的奖励，家长审批
· 里程碑徽章、连击、本周趋势，进步看得见
· 家长 PIN / Face ID 守护管理权限，孩子端只读
· 纯本地存储，不联网、不采集、无广告、无追踪
· 一次买断，无内购

适合 3 岁以上孩子的家庭日常激励。
```

**Description (English)**
```
Reward Stars helps parents guide kids toward good habits with points and rewards.

· Custom reward/penalty rules, one-tap scoring with undo
· Kids save stars to redeem rewards you set, with parent approval
· Milestone badges, streaks, and weekly trends make progress visible
· Parent area protected by PIN / Face ID; kids get a read-only view
· Fully on-device — no network, no data collection, no ads, no tracking
· One-time purchase, no in-app purchases

A simple daily motivation tool for families with kids aged 3+.
```

**What's New (1.0)**: 首个版本。/ Initial release.
