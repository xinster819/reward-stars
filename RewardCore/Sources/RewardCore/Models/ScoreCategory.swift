import Foundation

/// 行为类别。MVP 固定四类，家长建规则时选择。
public enum ScoreCategory: String, Codable, CaseIterable, Sendable, Hashable {
    case learning   // 学习
    case life       // 生活
    case character  // 品德
    case other      // 其他

    /// 中文展示名。
    public var displayName: String {
        switch self {
        case .learning:  return "学习"
        case .life:      return "生活"
        case .character: return "品德"
        case .other:     return "其他"
        }
    }

    /// 该类别的默认 SF Symbol 图标名。
    public var defaultIconName: String {
        switch self {
        case .learning:  return "book.fill"
        case .life:      return "house.fill"
        case .character: return "heart.fill"
        case .other:     return "star.fill"
        }
    }
}
