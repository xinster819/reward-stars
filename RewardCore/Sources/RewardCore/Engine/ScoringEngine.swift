import Foundation

/// 计分相关的纯计算。所有方法只读输入、无副作用，便于确定性单测。
public enum ScoringEngine {

    /// 当前积分余额 = 有效事件分值之和 − 已通过兑换的花费之和。
    public static func balance(events: [ScoreEvent], redemptions: [RedemptionRequest]) -> Int {
        let earned = events.filter { !$0.isVoided }.reduce(0) { $0 + $1.points }
        let spent = redemptions.filter { $0.status == .approved }.reduce(0) { $0 + $1.cost }
        return earned - spent
    }

    /// 累计获得分（仅统计有效且为正的事件），用于里程碑徽章，不因花费/扣分而回退。
    public static func cumulativeEarned(events: [ScoreEvent]) -> Int {
        events.filter { !$0.isVoided && $0.points > 0 }.reduce(0) { $0 + $1.points }
    }

    /// 指定时间区间 [start, end) 内有效事件的净分。
    public static func netPoints(events: [ScoreEvent], in interval: DateInterval) -> Int {
        events
            .filter { !$0.isVoided && $0.timestamp >= interval.start && $0.timestamp < interval.end }
            .reduce(0) { $0 + $1.points }
    }

    /// 包含 now 的"本周"区间（依日历 firstWeekday 决定周起点）。
    public static func currentWeekInterval(now: Date, calendar: Calendar = .current) -> DateInterval {
        calendar.dateInterval(of: .weekOfYear, for: now)
            ?? DateInterval(start: now, duration: 7 * 86_400)
    }

    /// 最近一条可撤销（未作废）事件——按时间倒序取第一条。
    public static func lastUndoableEvent(events: [ScoreEvent]) -> ScoreEvent? {
        events.filter { !$0.isVoided }.max { $0.timestamp < $1.timestamp }
    }

    /// 最近的有效事件，按时间倒序，限制条数。
    public static func recentEvents(events: [ScoreEvent], limit: Int) -> [ScoreEvent] {
        Array(events.filter { !$0.isVoided }
            .sorted { $0.timestamp > $1.timestamp }
            .prefix(max(0, limit)))
    }

    /// 最近 `days` 天每天的净分，最旧在前。每个 date 为当天 00:00。
    public static func dailyNetTotals(
        events: [ScoreEvent],
        days: Int,
        endingOn: Date,
        calendar: Calendar = .current
    ) -> [DailyScore] {
        guard days > 0 else { return [] }
        let endDay = calendar.startOfDay(for: endingOn)
        let active = events.filter { !$0.isVoided }
        return (0..<days).reversed().compactMap { back -> DailyScore? in
            guard let dayStart = calendar.date(byAdding: .day, value: -back, to: endDay) else { return nil }
            let net = active
                .filter { calendar.isDate($0.timestamp, inSameDayAs: dayStart) }
                .reduce(0) { $0 + $1.points }
            return DailyScore(date: dayStart, net: net)
        }
    }
}
