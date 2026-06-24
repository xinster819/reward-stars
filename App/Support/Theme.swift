import SwiftUI
import RewardCore

/// 配色与视觉常量。孩子端用明亮色，类别有固定色。
enum Theme {
    static func color(for category: ScoreCategory) -> Color {
        switch category {
        case .learning:  return .blue
        case .life:      return .green
        case .character: return .pink
        case .other:     return .orange
        }
    }

    static let positive = Color.green
    static let negative = Color.red
    static let accent = Color.orange

    static func pointColor(_ points: Int) -> Color {
        points >= 0 ? positive : negative
    }

    /// 带符号分值文案，如 "+10" / "-5"。
    static func pointText(_ points: Int) -> String {
        points >= 0 ? "+\(points)" : "\(points)"
    }
}
