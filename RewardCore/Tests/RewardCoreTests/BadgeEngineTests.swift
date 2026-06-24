import XCTest
@testable import RewardCore

final class BadgeEngineTests: XCTestCase {

    private func cal() -> Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(secondsFromGMT: 0)!
        c.firstWeekday = 2
        return c
    }
    private func day(_ offset: Int) -> Date {
        Date(timeIntervalSince1970: 1_704_067_200 + Double(offset) * 86_400 + 12 * 3_600)
    }
    private func event(_ points: Int, at date: Date) -> ScoreEvent {
        ScoreEvent(ruleID: UUID(), ruleName: "r", category: .learning, points: points, timestamp: date)
    }

    func testNoBadgesWhenNothingEarned() {
        XCTAssertTrue(BadgeEngine.earnedBadges(events: [], asOf: day(0), calendar: cal()).isEmpty)
    }

    func testMilestoneAndStreakBadgesEarned() {
        // 每天 +40，连续三天 → 累计 120（解锁 50/100），连击 3（解锁 streak_3）
        let events = [event(40, at: day(0)), event(40, at: day(1)), event(40, at: day(2))]
        let ids = BadgeEngine.earnedBadges(events: events, asOf: day(2), calendar: cal()).map(\.id)
        XCTAssertEqual(ids, ["milestone_50", "milestone_100", "streak_3"])
    }

    func testSevenDayStreakEarnsBothStreakBadges() {
        let events = (0...6).map { event(10, at: day($0)) }
        let ids = BadgeEngine.earnedBadges(events: events, asOf: day(6), calendar: cal()).map(\.id)
        XCTAssertTrue(ids.contains("streak_3"))
        XCTAssertTrue(ids.contains("streak_7"))
    }

    func testNextMilestoneRemaining() {
        let events = [event(120, at: day(0))]
        let progress = BadgeEngine.nextMilestone(events: events)
        XCTAssertEqual(progress?.target, 200)
        XCTAssertEqual(progress?.current, 120)
        XCTAssertEqual(progress?.remaining, 80)
        XCTAssertEqual(progress?.badge.id, "milestone_200")
    }

    func testNextMilestoneNilWhenAllReached() {
        let events = [event(600, at: day(0))]
        XCTAssertNil(BadgeEngine.nextMilestone(events: events))
    }

    func testNextMilestoneFractionClamped() {
        let progress = BadgeEngine.nextMilestone(events: [event(10, at: day(0))])
        XCTAssertEqual(progress?.target, 50)
        XCTAssertEqual(progress?.fraction ?? 0, 0.2, accuracy: 0.0001)
    }
}
