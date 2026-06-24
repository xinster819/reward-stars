import XCTest
@testable import RewardCore

final class RedemptionPolicyTests: XCTestCase {

    func testCanAffordWhenBalanceMeetsCost() {
        let reward = Reward(name: "看电视", cost: 20)
        XCTAssertTrue(RedemptionPolicy.canAfford(reward: reward, balance: 20))
        XCTAssertTrue(RedemptionPolicy.canAfford(reward: reward, balance: 25))
    }

    func testCannotAffordWhenBalanceBelowCost() {
        let reward = Reward(name: "看电视", cost: 20)
        XCTAssertFalse(RedemptionPolicy.canAfford(reward: reward, balance: 19))
    }

    func testPointsNeeded() {
        let reward = Reward(name: "看电视", cost: 20)
        XCTAssertEqual(RedemptionPolicy.pointsNeeded(reward: reward, balance: 5), 15)
        XCTAssertEqual(RedemptionPolicy.pointsNeeded(reward: reward, balance: 20), 0)
        XCTAssertEqual(RedemptionPolicy.pointsNeeded(reward: reward, balance: 30), 0)
    }

    func testAffordableRewardsFiltersActiveAndAffordableSortedByOrder() {
        let rewards = [
            Reward(name: "贵", cost: 100, sortOrder: 0),
            Reward(name: "便宜", cost: 10, sortOrder: 2),
            Reward(name: "停用", cost: 5, isActive: false, sortOrder: 1),
            Reward(name: "刚好", cost: 30, sortOrder: 1)
        ]
        let affordable = RedemptionPolicy.affordableRewards(rewards: rewards, balance: 30)
        XCTAssertEqual(affordable.map(\.name), ["刚好", "便宜"])
    }
}
