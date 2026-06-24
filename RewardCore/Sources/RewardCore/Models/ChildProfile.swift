import Foundation

/// 孩子档案。MVP 仅一个孩子，但所有业务实体以 childID 关联，便于将来扩展多孩子。
public struct ChildProfile: Identifiable, Codable, Sendable, Equatable {
    public let id: UUID
    public var name: String
    public var avatarSymbol: String   // SF Symbol 名（跨设备稳定渲染）
    public var createdAt: Date

    public init(
        id: UUID = UUID(),
        name: String,
        avatarSymbol: String = "figure.child",
        createdAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.avatarSymbol = avatarSymbol
        self.createdAt = createdAt
    }

    /// 单孩子 MVP 下使用的固定示例孩子 ID（便于测试与默认关联）。
    public static let sampleChildID = UUID(uuidString: "00000000-0000-0000-0000-0000000000C1")!
}
