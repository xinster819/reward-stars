import XCTest
@testable import RewardCore

final class SampleDataTests: XCTestCase {

    func testSampleBundleInvariants() {
        let now = Date(timeIntervalSince1970: 1_704_067_200 + 10 * 86_400)
        let bundle = SampleData.make(now: now)

        XCTAssertFalse(bundle.rules.isEmpty)
        XCTAssertFalse(bundle.rewards.isEmpty)
        XCTAssertFalse(bundle.events.isEmpty)

        let cid = bundle.child.id
        XCTAssertTrue(bundle.rules.allSatisfy { $0.childID == cid })
        XCTAssertTrue(bundle.rewards.allSatisfy { $0.childID == cid })
        XCTAssertTrue(bundle.events.allSatisfy { $0.childID == cid })

        XCTAssertTrue(bundle.rules.contains { $0.isReward }, "应含奖励规则")
        XCTAssertTrue(bundle.rules.contains { !$0.isReward }, "应含惩罚规则")

        XCTAssertTrue(bundle.events.allSatisfy { !$0.isVoided })
        XCTAssertTrue(bundle.events.allSatisfy { $0.timestamp <= now })
        XCTAssertTrue(bundle.events.allSatisfy { $0.timestamp >= now.addingTimeInterval(-14 * 86_400) })

        XCTAssertGreaterThan(
            ScoringEngine.balance(events: bundle.events, redemptions: bundle.redemptions), 0,
            "初始余额应为正，正向激励")
    }

    func testSampleEventsReferenceExistingRules() {
        let bundle = SampleData.make()
        let ruleIDs = Set(bundle.rules.map(\.id))
        XCTAssertTrue(bundle.events.allSatisfy { event in
            event.ruleID == nil || ruleIDs.contains(event.ruleID!)
        })
    }

    func testSampleHasEnoughBreadthForDemo() {
        let bundle = SampleData.make()
        XCTAssertGreaterThanOrEqual(bundle.rules.count, 6)
        XCTAssertGreaterThanOrEqual(bundle.rewards.count, 4)
        XCTAssertGreaterThanOrEqual(bundle.events.count, 8)
        // 覆盖全部四个类别
        XCTAssertEqual(Set(bundle.rules.map(\.category)), Set(ScoreCategory.allCases))
    }
}
