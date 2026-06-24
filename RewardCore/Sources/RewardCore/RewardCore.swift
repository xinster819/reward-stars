import Foundation

/// RewardCore — 纯领域逻辑层（无 UI / 无 SwiftData 依赖）。
/// 业务规则（计分、徽章、连击、兑换资格、趋势）集中于此，可被 `swift test` 快速、确定性覆盖。
public enum RewardCore {
    /// 领域层版本号，用于冒烟自检。
    public static let version = "0.1.0"
}
