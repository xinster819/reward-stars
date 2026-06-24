import XCTest
@testable import RewardCore

final class ModelTests: XCTestCase {

    func testScoreCategoryDisplayNames() {
        XCTAssertEqual(ScoreCategory.learning.displayName, "学习")
        XCTAssertEqual(ScoreCategory.life.displayName, "生活")
        XCTAssertEqual(ScoreCategory.character.displayName, "品德")
        XCTAssertEqual(ScoreCategory.other.displayName, "其他")
        XCTAssertEqual(ScoreCategory.allCases.count, 4)
    }

    func testScoreCategoryHasDefaultIcon() {
        for category in ScoreCategory.allCases {
            XCTAssertFalse(category.defaultIconName.isEmpty, "\(category) 应有默认图标")
        }
    }

    func testBehaviorRuleIsRewardBySign() {
        let reward = BehaviorRule(name: "认真完成作业", category: .learning, points: 10)
        let penalty = BehaviorRule(name: "顶撞父母", category: .character, points: -5)
        XCTAssertTrue(reward.isReward)
        XCTAssertFalse(penalty.isReward)
    }

    func testBehaviorRuleDefaultsIconFromCategory() {
        let rule = BehaviorRule(name: "x", category: .learning, points: 1)
        XCTAssertEqual(rule.iconName, ScoreCategory.learning.defaultIconName)
        XCTAssertTrue(rule.isActive)
    }

    func testScoreEventCodableRoundTrip() throws {
        let event = ScoreEvent(
            ruleID: UUID(),
            ruleName: "认真完成作业",
            category: .life,
            points: 3,
            note: "做得好",
            timestamp: Date(timeIntervalSince1970: 1000),
            childID: ChildProfile.sampleChildID
        )
        let data = try JSONEncoder().encode(event)
        let decoded = try JSONDecoder().decode(ScoreEvent.self, from: data)
        XCTAssertEqual(decoded, event)
    }

    func testRewardCodableRoundTrip() throws {
        let reward = Reward(name: "看30分钟电视", cost: 20)
        let data = try JSONEncoder().encode(reward)
        let decoded = try JSONDecoder().decode(Reward.self, from: data)
        XCTAssertEqual(decoded, reward)
    }

    func testRedemptionRequestDefaultsToPending() {
        let request = RedemptionRequest(rewardID: UUID(), rewardName: "看电视", cost: 20)
        XCTAssertEqual(request.status, .pending)
        XCTAssertNil(request.decidedAt)
    }
}
