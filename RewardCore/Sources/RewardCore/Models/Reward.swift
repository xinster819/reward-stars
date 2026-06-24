import Foundation

/// 奖励目录项（家长维护）。cost 为兑换所需积分（正数）。
public struct Reward: Identifiable, Codable, Sendable, Equatable {
    public let id: UUID
    public var name: String
    public var cost: Int
    public var iconName: String
    public var isActive: Bool
    public var sortOrder: Int
    public var createdAt: Date
    public var childID: UUID

    public init(
        id: UUID = UUID(),
        name: String,
        cost: Int,
        iconName: String = "gift.fill",
        isActive: Bool = true,
        sortOrder: Int = 0,
        createdAt: Date = Date(),
        childID: UUID = ChildProfile.sampleChildID
    ) {
        self.id = id
        self.name = name
        self.cost = cost
        self.iconName = iconName
        self.isActive = isActive
        self.sortOrder = sortOrder
        self.createdAt = createdAt
        self.childID = childID
    }
}
