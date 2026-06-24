import XCTest
@testable import RewardCore

final class StreakCalculatorTests: XCTestCase {

    private func cal() -> Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(secondsFromGMT: 0)!
        c.firstWeekday = 2
        return c
    }
    private func day(_ offset: Int, hour: Int = 12) -> Date {
        Date(timeIntervalSince1970: 1_704_067_200 + Double(offset) * 86_400 + Double(hour) * 3_600)
    }
    private func event(_ points: Int, at date: Date, voided: Bool = false) -> ScoreEvent {
        ScoreEvent(ruleID: UUID(), ruleName: "r", category: .learning,
                   points: points, timestamp: date, isVoided: voided)
    }

    func testConsecutivePositiveDaysCountsStreak() {
        let events = [event(10, at: day(0)), event(5, at: day(1)), event(3, at: day(2))]
        XCTAssertEqual(StreakCalculator.currentStreak(events: events, asOf: day(2), calendar: cal()), 3)
    }

    func testStreakBrokenWhenTodayNotPositive() {
        let events = [event(10, at: day(0)), event(5, at: day(1)), event(-2, at: day(2))]
        XCTAssertEqual(StreakCalculator.currentStreak(events: events, asOf: day(2), calendar: cal()), 0)
    }

    func testStreakStopsAtGap() {
        // day1 缺失（净0），asOf=day2 → 只有 day2 计入
        let events = [event(10, at: day(0)), event(5, at: day(2))]
        XCTAssertEqual(StreakCalculator.currentStreak(events: events, asOf: day(2), calendar: cal()), 1)
    }

    func testNetZeroDayDoesNotCount() {
        let events = [event(5, at: day(2)), event(-5, at: day(2))] // 当天净 0
        XCTAssertEqual(StreakCalculator.currentStreak(events: events, asOf: day(2), calendar: cal()), 0)
    }

    func testVoidedEventsExcludedFromStreak() {
        let events = [event(5, at: day(2), voided: true)]
        XCTAssertEqual(StreakCalculator.currentStreak(events: events, asOf: day(2), calendar: cal()), 0)
    }

    func testNoEventsMeansZeroStreak() {
        XCTAssertEqual(StreakCalculator.currentStreak(events: [], asOf: day(2), calendar: cal()), 0)
    }
}
