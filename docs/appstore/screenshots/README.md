# App Store 截图 / Screenshots

由 [`../generate-screenshots.sh`](../generate-screenshots.sh) 用 iOS 模拟器自动生成。
**全部为 `SampleData` 示例数据**（孩子名「宝贝 / My Child」、通用插画头像），无任何真实数据。

## 内容
两个 ASC 必需尺寸 × 中英双语 × 5 屏 = 20 张：

| 目录 | 设备 | 像素 |
|---|---|---|
| `iphone-6.9/` | iPhone 17 Pro Max（6.9"） | 1320 × 2868 |
| `ipad-13/`    | iPad Pro 13-inch（M5，13"） | 2064 × 2752 |

每个语言子目录（`zh-Hans/`、`en/`）下：

| 文件 | 屏 |
|---|---|
| `01-welcome` | 首启欢迎（品牌星 hero） |
| `02-home` | 孩子端今天（进度环 / 连击 / 徽章 / 最近表现，总分 74） |
| `03-store` | 奖励商店（可兑换，余额 74） |
| `04-parent-overview` | 家长总览（当前总分 / 本周净得 / 近 7 天趋势 / 最近记录） |
| `05-rules` | 规则管理 |

## 重新生成
```bash
bash docs/appstore/generate-screenshots.sh
```
依赖：已安装 `iPhone 17 Pro Max` 与 `iPad Pro 13-inch (M5)` 模拟器（名称在脚本顶部，可改）。
时间统一显示 9:41、满电满信号（`simctl status_bar override`）。

## 上传
ASC 只需 6.9" + 13" 两组（其余尺寸自适应，最终以 ASC 当时要求为准）。
中文版传 `zh-Hans/`、英文版传 `en/`。可直接用，也可后期加文案/设备框美化。
