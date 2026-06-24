import Foundation
import RewardCore

/// 仪表盘聚合视图模型：把领域事件/兑换喂给 RewardCore 引擎，产出展示所需的派生值。
/// 家长端与孩子端共用，保证两端口径一致。
struct ScoreSummary {
    let balance: Int
    let weeklyNet: Int
    let streak: Int
    let badges: [Badge]
    let nextMilestone: MilestoneProgress?
    let recent: [ScoreEvent]
    let trend: [DailyScore]

    init(events: [ScoreEvent],
         redemptions: [RedemptionRequest],
         now: Date = Date(),
         calendar: Calendar = .current,
         recentLimit: Int = AppConfig.recentEventsCount,
         trendDays: Int = AppConfig.trendDays) {
        balance = ScoringEngine.balance(events: events, redemptions: redemptions)
        let week = ScoringEngine.currentWeekInterval(now: now, calendar: calendar)
        weeklyNet = ScoringEngine.netPoints(events: events, in: week)
        streak = StreakCalculator.currentStreak(events: events, asOf: now, calendar: calendar)
        badges = BadgeEngine.earnedBadges(events: events, asOf: now, calendar: calendar)
        nextMilestone = BadgeEngine.nextMilestone(events: events)
        recent = ScoringEngine.recentEvents(events: events, limit: recentLimit)
        trend = ScoringEngine.dailyNetTotals(events: events, days: trendDays, endingOn: now, calendar: calendar)
    }
}
