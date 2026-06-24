import XCTest
import SwiftData
import RewardCore
@testable import RewardingSystem

@MainActor
final class RewardRepositoryTests: XCTestCase {

    private func makeRepo() throws -> RewardRepository {
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        let container = try ModelContainer(for: Schema(AppSchema.models), configurations: config)
        return RewardRepository(context: ModelContext(container))
    }

    private let now = Date(timeIntervalSince1970: 1_704_067_200 + 10 * 86_400)

    func testSeedIsCleanStartAndIdempotent() throws {
        let repo = try makeRepo()
        XCTAssertTrue(repo.isEmpty())
        repo.seedSampleDataIfNeeded(now: now)
        // 干净起步：有规则与奖励目录，但无流水、总分为 0
        XCTAssertGreaterThan(repo.rules().count, 0)
        XCTAssertGreaterThan(repo.rewards().count, 0)
        XCTAssertEqual(repo.events().count, 0)
        XCTAssertEqual(repo.balance(), 0)
        XCTAssertNotNil(repo.child())
        XCTAssertFalse(repo.isEmpty())
        // 再次调用不应重复 seed
        let ruleCount = repo.rules().count
        repo.seedSampleDataIfNeeded(now: now)
        XCTAssertEqual(repo.rules().count, ruleCount)
    }

    func testRenameChild() throws {
        let repo = try makeRepo()
        repo.seedSampleDataIfNeeded(now: now)
        repo.renameChild("小红")
        XCTAssertEqual(repo.child()?.name, "小红")
    }

    func testClearScoresZeroesBalanceButKeepsRulesAndRewards() throws {
        let repo = try makeRepo()
        let rule = repo.addRule(name: "作业", category: .learning, points: 30, iconName: nil)
        let reward = repo.addReward(name: "看电视", cost: 10, iconName: nil)
        repo.recordScore(ruleID: rule.id, note: nil, at: now)
        repo.requestRedemption(rewardID: reward.id, at: now)
        repo.approveRedemption(id: repo.pendingRedemptions().first!.id, at: now)
        XCTAssertNotEqual(repo.balance(), 0)

        repo.clearScores()
        XCTAssertEqual(repo.balance(), 0)
        XCTAssertEqual(repo.events().count, 0)
        XCTAssertEqual(repo.redemptions().count, 0)
        XCTAssertEqual(repo.rules().count, 1, "规则应保留")
        XCTAssertEqual(repo.rewards().count, 1, "奖励应保留")
    }

    func testRecordScoreCreatesEventAndUpdatesBalance() throws {
        let repo = try makeRepo()
        let rule = repo.addRule(name: "作业", category: .learning, points: 10, iconName: nil)
        XCTAssertTrue(repo.recordScore(ruleID: rule.id, note: "棒", at: now))
        XCTAssertEqual(repo.events().count, 1)
        XCTAssertEqual(repo.balance(), 10)
        XCTAssertEqual(repo.events().first?.note, "棒")
    }

    func testRecordScoreUnknownRuleReturnsFalse() throws {
        let repo = try makeRepo()
        XCTAssertFalse(repo.recordScore(ruleID: UUID(), note: nil, at: now))
        XCTAssertEqual(repo.events().count, 0)
    }

    func testUndoLastVoidsMostRecentAndRevertsBalance() throws {
        let repo = try makeRepo()
        let rule = repo.addRule(name: "作业", category: .learning, points: 10, iconName: nil)
        repo.recordScore(ruleID: rule.id, note: nil, at: now.addingTimeInterval(-100))
        repo.recordScore(ruleID: rule.id, note: nil, at: now)
        XCTAssertEqual(repo.balance(), 20)

        let undone = repo.undoLastEvent()
        XCTAssertNotNil(undone)
        XCTAssertEqual(repo.balance(), 10)
        XCTAssertEqual(repo.recentEvents(limit: 10).count, 1) // 作废的不计入

        XCTAssertNotNil(repo.undoLastEvent())
        XCTAssertEqual(repo.balance(), 0)
        XCTAssertNil(repo.undoLastEvent()) // 没有可撤销的了
    }

    func testRequestRedemptionPendingDoesNotAffectBalanceUntilApproved() throws {
        let repo = try makeRepo()
        let rule = repo.addRule(name: "作业", category: .learning, points: 30, iconName: nil)
        repo.recordScore(ruleID: rule.id, note: nil, at: now)
        let reward = repo.addReward(name: "看电视", cost: 20, iconName: nil)

        XCTAssertTrue(repo.requestRedemption(rewardID: reward.id, at: now))
        XCTAssertEqual(repo.balance(), 30, "待确认不应扣分")
        XCTAssertEqual(repo.pendingRedemptions().count, 1)

        let pendingID = repo.pendingRedemptions().first!.id
        XCTAssertTrue(repo.approveRedemption(id: pendingID, at: now))
        XCTAssertEqual(repo.balance(), 10, "通过后扣分")
        XCTAssertEqual(repo.pendingRedemptions().count, 0)
    }

    func testApproveRedemptionFailsWhenInsufficientBalance() throws {
        let repo = try makeRepo()
        let rule = repo.addRule(name: "作业", category: .learning, points: 10, iconName: nil)
        repo.recordScore(ruleID: rule.id, note: nil, at: now)
        let reward = repo.addReward(name: "贵奖励", cost: 50, iconName: nil)
        repo.requestRedemption(rewardID: reward.id, at: now)
        let pendingID = repo.pendingRedemptions().first!.id

        XCTAssertFalse(repo.approveRedemption(id: pendingID, at: now))
        XCTAssertEqual(repo.balance(), 10)
        XCTAssertEqual(repo.pendingRedemptions().count, 1, "余额不足应保持待确认")
    }

    func testRejectRedemptionKeepsBalance() throws {
        let repo = try makeRepo()
        let rule = repo.addRule(name: "作业", category: .learning, points: 30, iconName: nil)
        repo.recordScore(ruleID: rule.id, note: nil, at: now)
        let reward = repo.addReward(name: "看电视", cost: 20, iconName: nil)
        repo.requestRedemption(rewardID: reward.id, at: now)
        let pendingID = repo.pendingRedemptions().first!.id

        repo.rejectRedemption(id: pendingID, at: now)
        XCTAssertEqual(repo.balance(), 30)
        XCTAssertEqual(repo.pendingRedemptions().count, 0)
        XCTAssertEqual(repo.redemptions().first?.status, .rejected)
    }

    func testRuleCRUD() throws {
        let repo = try makeRepo()
        let rule = repo.addRule(name: "作业", category: .learning, points: 10, iconName: nil)
        repo.updateRule(id: rule.id, name: "认真作业", category: .learning, points: 12, iconName: "pencil")
        XCTAssertEqual(repo.rules().first?.name, "认真作业")
        XCTAssertEqual(repo.rules().first?.points, 12)

        repo.setRule(id: rule.id, active: false)
        XCTAssertTrue(repo.activeRules().isEmpty)
        XCTAssertEqual(repo.rules().count, 1)

        repo.deleteRule(id: rule.id)
        XCTAssertTrue(repo.rules().isEmpty)
    }
}
