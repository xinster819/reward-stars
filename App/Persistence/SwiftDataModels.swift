import Foundation
import SwiftData
import RewardCore

// SwiftData 持久化模型。采用扁平结构（用 childID / ruleID 关联，而非 SwiftData 关系），
// 与 RewardCore 领域结构一一对应；每个模型提供 toDomain() 供业务引擎使用。
// 所有实体带 childID，为将来多孩子预留。

@Model
final class ChildModel {
    @Attribute(.unique) var id: UUID
    var name: String
    var avatarSymbol: String
    var createdAt: Date

    init(id: UUID, name: String, avatarSymbol: String, createdAt: Date) {
        self.id = id
        self.name = name
        self.avatarSymbol = avatarSymbol
        self.createdAt = createdAt
    }

    convenience init(_ d: ChildProfile) {
        self.init(id: d.id, name: d.name, avatarSymbol: d.avatarSymbol, createdAt: d.createdAt)
    }

    func toDomain() -> ChildProfile {
        ChildProfile(id: id, name: name, avatarSymbol: avatarSymbol, createdAt: createdAt)
    }
}

@Model
final class RuleModel {
    @Attribute(.unique) var id: UUID
    var name: String
    // 新增（v1.1）：可选描述。可选属性的新增是 SwiftData 轻量迁移，老数据自动补 nil，不丢任何记录。
    var details: String?
    var category: ScoreCategory
    var points: Int
    var iconName: String
    var isActive: Bool
    var sortOrder: Int
    var createdAt: Date
    var childID: UUID

    init(id: UUID, name: String, details: String?, category: ScoreCategory, points: Int,
         iconName: String, isActive: Bool, sortOrder: Int, createdAt: Date, childID: UUID) {
        self.id = id
        self.name = name
        self.details = details
        self.category = category
        self.points = points
        self.iconName = iconName
        self.isActive = isActive
        self.sortOrder = sortOrder
        self.createdAt = createdAt
        self.childID = childID
    }

    convenience init(_ d: BehaviorRule) {
        self.init(id: d.id, name: d.name, details: d.details, category: d.category, points: d.points,
                  iconName: d.iconName, isActive: d.isActive, sortOrder: d.sortOrder,
                  createdAt: d.createdAt, childID: d.childID)
    }

    func toDomain() -> BehaviorRule {
        BehaviorRule(id: id, name: name, details: details, category: category, points: points,
                     iconName: iconName, isActive: isActive, sortOrder: sortOrder,
                     createdAt: createdAt, childID: childID)
    }
}

@Model
final class EventModel {
    @Attribute(.unique) var id: UUID
    var ruleID: UUID?
    var ruleName: String
    var category: ScoreCategory
    var points: Int
    var note: String?
    var timestamp: Date
    var childID: UUID
    var isVoided: Bool

    init(id: UUID, ruleID: UUID?, ruleName: String, category: ScoreCategory, points: Int,
         note: String?, timestamp: Date, childID: UUID, isVoided: Bool) {
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

    convenience init(_ d: ScoreEvent) {
        self.init(id: d.id, ruleID: d.ruleID, ruleName: d.ruleName, category: d.category,
                  points: d.points, note: d.note, timestamp: d.timestamp,
                  childID: d.childID, isVoided: d.isVoided)
    }

    func toDomain() -> ScoreEvent {
        ScoreEvent(id: id, ruleID: ruleID, ruleName: ruleName, category: category, points: points,
                   note: note, timestamp: timestamp, childID: childID, isVoided: isVoided)
    }
}

@Model
final class RewardModel {
    @Attribute(.unique) var id: UUID
    var name: String
    var cost: Int
    var iconName: String
    var isActive: Bool
    var sortOrder: Int
    var createdAt: Date
    var childID: UUID

    init(id: UUID, name: String, cost: Int, iconName: String,
         isActive: Bool, sortOrder: Int, createdAt: Date, childID: UUID) {
        self.id = id
        self.name = name
        self.cost = cost
        self.iconName = iconName
        self.isActive = isActive
        self.sortOrder = sortOrder
        self.createdAt = createdAt
        self.childID = childID
    }

    convenience init(_ d: Reward) {
        self.init(id: d.id, name: d.name, cost: d.cost, iconName: d.iconName,
                  isActive: d.isActive, sortOrder: d.sortOrder, createdAt: d.createdAt, childID: d.childID)
    }

    func toDomain() -> Reward {
        Reward(id: id, name: name, cost: cost, iconName: iconName,
               isActive: isActive, sortOrder: sortOrder, createdAt: createdAt, childID: childID)
    }
}

@Model
final class RedemptionModel {
    @Attribute(.unique) var id: UUID
    var rewardID: UUID?
    var rewardName: String
    var cost: Int
    var status: RedemptionStatus
    var requestedAt: Date
    var decidedAt: Date?
    var childID: UUID

    init(id: UUID, rewardID: UUID?, rewardName: String, cost: Int,
         status: RedemptionStatus, requestedAt: Date, decidedAt: Date?, childID: UUID) {
        self.id = id
        self.rewardID = rewardID
        self.rewardName = rewardName
        self.cost = cost
        self.status = status
        self.requestedAt = requestedAt
        self.decidedAt = decidedAt
        self.childID = childID
    }

    convenience init(_ d: RedemptionRequest) {
        self.init(id: d.id, rewardID: d.rewardID, rewardName: d.rewardName, cost: d.cost,
                  status: d.status, requestedAt: d.requestedAt, decidedAt: d.decidedAt, childID: d.childID)
    }

    func toDomain() -> RedemptionRequest {
        RedemptionRequest(id: id, rewardID: rewardID, rewardName: rewardName, cost: cost,
                          status: status, requestedAt: requestedAt, decidedAt: decidedAt, childID: childID)
    }
}

/// 应用 Schema：集中声明全部持久化模型，App 与测试共用。
/// 单一事实来源指向当前最新版本（见 SchemaVersions.swift / MIGRATIONS.md）。
enum AppSchema {
    static let models: [any PersistentModel.Type] = RewardSchemaV1.models
}
