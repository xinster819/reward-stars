import Foundation

/// 连击（连续达标天数）计算：从 asOf 当天往前数，连续每天净得分 > 0 的天数。
/// 当天净得分 ≤ 0 即连击为 0。
public enum StreakCalculator {

    public static func currentStreak(
        events: [ScoreEvent],
        asOf: Date,
        calendar: Calendar = .current
    ) -> Int {
        var netByDay: [Date: Int] = [:]
        for event in events where !event.isVoided {
            let dayStart = calendar.startOfDay(for: event.timestamp)
            netByDay[dayStart, default: 0] += event.points
        }

        var streak = 0
        var cursor = calendar.startOfDay(for: asOf)
        while let net = netByDay[cursor], net > 0 {
            streak += 1
            guard let previous = calendar.date(byAdding: .day, value: -1, to: cursor) else { break }
            cursor = previous
        }
        return streak
    }
}
