import Foundation

/// 一次记分流水。记录时对规则的名称/分值/类别做快照，
/// 这样家长事后改规则不会篡改历史。isVoided 用于"撤销"（软删除）。
public struct ScoreEvent: Identifiable, Codable, Sendable, Equatable {
    public let id: UUID
    public var ruleID: UUID?          // 规则被删后仍保留快照，可为 nil
    public var ruleName: String       // 快照
    public var category: ScoreCategory
    public var points: Int            // 带符号快照
    public var note: String?
    public var timestamp: Date
    public var childID: UUID
    public var isVoided: Bool

    public init(
        id: UUID = UUID(),
        ruleID: UUID?,
        ruleName: String,
        category: ScoreCategory,
        points: Int,
        note: String? = nil,
        timestamp: Date = Date(),
        childID: UUID = ChildProfile.sampleChildID,
        isVoided: Bool = false
    ) {
        self.id = id
        self.ruleID = ruleID
        self.ruleName = ruleName
        self.category = category
        self.points = points
        self.note = note
        self.timestamp = timestamp
        self.childID = childID
        self.isVoided = isVoided
    }

    /// 是否为加分事件。
    public var isPositive: Bool { points >= 0 }
}
