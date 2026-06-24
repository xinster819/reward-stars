import Foundation

/// 一枚徽章（成就）。id 为稳定标识，用于去重与判定是否已获得。
public struct Badge: Identifiable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let detail: String
    public let iconName: String

    public init(id: String, title: String, detail: String, iconName: String) {
        self.id = id
        self.title = title
        self.detail = detail
        self.iconName = iconName
    }
}

/// 距离下一个里程碑的进度。
public struct MilestoneProgress: Equatable, Sendable {
    public let current: Int
    public let target: Int
    public let badge: Badge

    public init(current: Int, target: Int, badge: Badge) {
        self.current = current
        self.target = target
        self.badge = badge
    }

    public var remaining: Int { max(0, target - current) }
    public var fraction: Double { target > 0 ? min(1, Double(current) / Double(target)) : 1 }
}
