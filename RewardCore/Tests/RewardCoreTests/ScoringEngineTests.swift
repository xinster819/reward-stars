import XCTest
@testable import RewardCore

final class ScoringEngineTests: XCTestCase {

    /// 固定 UTC、周一为一周第一天的日历，保证测试确定性。
    private func cal() -> Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(secondsFromGMT: 0)!
        c.firstWeekday = 2
        return c
    }

    // 2024-01-01 00:00:00 UTC 是周一
    private let monday = Date(timeIntervalSince1970: 1_704_067_200)
    private func day(_ offset: Int, hour: Int = 12) -> Date {
        Date(timeIntervalSince1970: 1_704_067_200 + Double(offset) * 86_400 + Double(hour) * 3_600)
    }

    private func event(_ points: Int, at date: Date, voided: Bool = false) -> ScoreEvent {
        ScoreEvent(ruleID: UUID(), ruleName: "r", category: .learning,
                   points: points, timestamp: date, isVoided: voided)
    }

    func testBalanceSumsActiveEventsMinusApprovedRedemptions() {
        let events = [event(10, at: day(0)), event(5, at: day(1)),
                      event(-3, at: day(2)), event(2, at: day(3), voided: true)]
        let redemptions = [
            RedemptionRequest(rewardID: UUID(), rewardName: "x", cost: 4, status: .approved),
            RedemptionRequest(rewardID: UUID(), rewardName: "y", cost: 100, status: .pending),
            RedemptionRequest(rewardID: UUID(), rewardName: "z", cost: 50, status: .rejected)
        ]
        // (10 + 5 - 3) - 4 = 8 ; voided event & non-approved redemptions excluded
        XCTAssertEqual(ScoringEngine.balance(events: events, redemptions: redemptions), 8)
    }

    func testCumulativeEarnedCountsOnlyPositiveActive() {
        let events = [event(10, at: day(0)), event(5, at: day(1)),
                      event(-3, at: day(2)), event(7, at: day(3), voided: true)]
        XCTAssertEqual(ScoringEngine.cumulativeEarned(events: events), 15)
    }

    func testNetPointsWithinInterval() {
        let events = [event(10, at: day(0)), event(5, at: day(2)), event(8, at: day(9))]
        let interval = DateInterval(start: day(0, hour: 0), end: day(7, hour: 0))
        XCTAssertEqual(ScoringEngine.netPoints(events: events, in: interval), 15)
    }

    func testLastUndoableEventSkipsVoidedAndPicksMostRecent() {
        let e1 = event(10, at: day(0))
        let e2 = event(5, at: day(2))
        let e3 = event(3, at: day(4), voided: true) // 最近但已作废
        let last = ScoringEngine.lastUndoableEvent(events: [e1, e3, e2])
        XCTAssertEqual(last?.id, e2.id)
    }

    func testLastUndoableEventNilWhenAllVoided() {
        XCTAssertNil(ScoringEngine.lastUndoableEvent(events: [event(10, at: day(0), voided: true)]))
    }

    func testRecentEventsSortedDescAndLimited() {
        let e1 = event(1, at: day(0))
        let e2 = event(2, at: day(1))
        let e3 = event(3, at: day(2))
        let voided = event(9, at: day(3), voided: true)
        let recent = ScoringEngine.recentEvents(events: [e1, e3, voided, e2], limit: 2)
        XCTAssertEqual(recent.map(\.id), [e3.id, e2.id])
    }

    func testCurrentWeekIntervalMondayBased() {
        let wednesday = day(2)
        let interval = ScoringEngine.currentWeekInterval(now: wednesday, calendar: cal())
        XCTAssertEqual(interval.start, day(0, hour: 0))          // 周一 00:00
        XCTAssertEqual(interval.duration, 7 * 86_400, accuracy: 1)
    }

    func testDailyNetTotalsAcrossDays() {
        let events = [event(10, at: day(0)), event(-3, at: day(1)),
                      event(5, at: day(2)), event(7, at: day(2), voided: true)]
        let totals = ScoringEngine.dailyNetTotals(
            events: events, days: 3, endingOn: day(2), calendar: cal())
        XCTAssertEqual(totals.map(\.net), [10, -3, 5])
        XCTAssertEqual(totals.first?.date, day(0, hour: 0))
        XCTAssertEqual(totals.last?.date, day(2, hour: 0))
    }
}
