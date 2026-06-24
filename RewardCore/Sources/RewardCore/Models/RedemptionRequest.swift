import Foundation

/// 兑换请求/记录。孩子发起 → 家长确认（approve/reject）。
/// 仅当 status == .approved 时扣减积分余额。
public enum RedemptionStatus: String, Codable, Sendable {
    case pending    // 待家长确认
    case approved   // 已通过（扣分）
    case rejected   // 已驳回

    public var displayName: String {
        switch self {
        case .pending:  return "待确认"
        case .approved: return "已兑换"
        case .rejected: return "已驳回"
        }
    }
}

public struct RedemptionRequest: Identifiable, Codable, Sendable, Equatable {
    public let id: UUID
    public var rewardID: UUID?
    public var rewardName: String     // 快照
    public var cost: Int              // 快照
    public var status: RedemptionStatus
    public var requestedAt: Date
    public var decidedAt: Date?
    public var childID: UUID

    public init(
        id: UUID = UUID(),
        rewardID: UUID?,
        rewardName: String,
        cost: Int,
        status: RedemptionStatus = .pending,
        requestedAt: Date = Date(),
        decidedAt: Date? = nil,
        childID: UUID = ChildProfile.sampleChildID
    ) {
        self.id = id
        self.rewardID = rewardID
        self.rewardName = rewardName
        self.cost = cost
        self.status = status
        self.requestedAt = requestedAt
        self.decidedAt = decidedAt
        self.childID = childID
    }
}
