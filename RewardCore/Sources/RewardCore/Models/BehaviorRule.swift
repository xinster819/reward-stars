import Foundation

/// 奖惩规则。points 带符号：>=0 为奖励（加分），<0 为惩罚（扣分）。
public struct BehaviorRule: Identifiable, Codable, Sendable, Equatable {
    public let id: UUID
    public var name: String
    /// 规则细节描述（最多 200 字，可选）。向后兼容：老数据/老备份缺此字段时为 nil。
    public var details: String?
    public var category: ScoreCategory
    public var points: Int
    public var iconName: String
    public var isActive: Bool
    public var sortOrder: Int
    public var createdAt: Date
    public var childID: UUID

    /// 描述最大字数。
    public static let detailsMaxLength = 200

    public init(
        id: UUID = UUID(),
        name: String,
        details: String? = nil,
        category: ScoreCategory,
        points: Int,
        iconName: String? = nil,
        isActive: Bool = true,
        sortOrder: Int = 0,
        createdAt: Date = Date(),
        childID: UUID = ChildProfile.sampleChildID
    ) {
        self.id = id
        self.name = name
        self.details = details
        self.category = category
        self.points = points
        self.iconName = iconName ?? category.defaultIconName
        self.isActive = isActive
        self.sortOrder = sortOrder
        self.createdAt = createdAt
        self.childID = childID
    }

    /// 是否为奖励规则（加分）。
    public var isReward: Bool { points >= 0 }
}
