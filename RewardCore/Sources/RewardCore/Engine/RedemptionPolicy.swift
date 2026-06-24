import Foundation

/// 兑换资格的纯判定。
public enum RedemptionPolicy {

    /// 余额是否够兑换该奖励。
    public static func canAfford(reward: Reward, balance: Int) -> Bool {
        balance >= reward.cost
    }

    /// 还差多少分才能兑换（够了返回 0）。
    public static func pointsNeeded(reward: Reward, balance: Int) -> Int {
        max(0, reward.cost - balance)
    }

    /// 当前余额下"可兑换"的奖励：仅启用且买得起，按 sortOrder 升序。
    public static func affordableRewards(rewards: [Reward], balance: Int) -> [Reward] {
        rewards
            .filter { $0.isActive && canAfford(reward: $0, balance: balance) }
            .sorted { $0.sortOrder < $1.sortOrder }
    }
}
