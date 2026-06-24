import SwiftUI
import RewardCore

/// 把 RewardCore 里的中文领域字符串当作本地化 key，在 App 主 bundle 里查当前语言的译文。
/// 这样 RewardCore 保持纯净（其字符串即 key），翻译集中在 App 的 Localizable.xcstrings。
func loc(_ zhKey: String) -> String {
    String(localized: String.LocalizationValue(zhKey))
}

extension ScoreCategory {
    var localizedName: String { loc(displayName) }
}

extension RedemptionStatus {
    var localizedName: String { loc(displayName) }
}

extension Badge {
    var localizedTitle: String { loc(title) }
    var localizedDetail: String { loc(detail) }
}
