import Foundation

/// 游戏化徽章：从历史实时派生（不落库），避免状态与历史不一致。
/// 两类徽章：累计获得分里程碑、连击天数。
public enum BadgeEngine {

    /// 里程碑阈值（累计获得分）。
    public static let milestoneThresholds = [50, 100, 200, 500]
    /// 连击阈值（连续达标天数）。
    public static let streakThresholds = [3, 7]

    private static func milestoneBadge(_ threshold: Int) -> Badge {
        switch threshold {
        case 50:  return Badge(id: "milestone_50",  title: "起步星", detail: "累计获得 50 分", iconName: "leaf.fill")
        case 100: return Badge(id: "milestone_100", title: "百分达人", detail: "累计获得 100 分", iconName: "star.fill")
        case 200: return Badge(id: "milestone_200", title: "超级明星", detail: "累计获得 200 分", iconName: "rosette")
        default:  return Badge(id: "milestone_500", title: "积分大师", detail: "累计获得 500 分", iconName: "crown.fill")
        }
    }

    private static func streakBadge(_ threshold: Int) -> Badge {
        switch threshold {
        case 3:  return Badge(id: "streak_3", title: "三连击", detail: "连续 3 天表现棒", iconName: "flame.fill")
        default: return Badge(id: "streak_7", title: "七日坚持", detail: "连续 7 天表现棒", iconName: "flame.circle.fill")
        }
    }

    /// 已获得的徽章：里程碑（升序）在前，连击（升序）在后。
    public static func earnedBadges(
        events: [ScoreEvent],
        asOf: Date,
        calendar: Calendar = .current
    ) -> [Badge] {
        let earned = ScoringEngine.cumulativeEarned(events: events)
        let streak = StreakCalculator.currentStreak(events: events, asOf: asOf, calendar: calendar)

        var badges: [Badge] = []
        for threshold in milestoneThresholds where earned >= threshold {
            badges.append(milestoneBadge(threshold))
        }
        for threshold in streakThresholds where streak >= threshold {
            badges.append(streakBadge(threshold))
        }
        return badges
    }

    /// 距离下一个未达成里程碑的进度；全部达成返回 nil。
    public static func nextMilestone(events: [ScoreEvent]) -> MilestoneProgress? {
        let earned = ScoringEngine.cumulativeEarned(events: events)
        guard let target = milestoneThresholds.first(where: { earned < $0 }) else { return nil }
        return MilestoneProgress(current: earned, target: target, badge: milestoneBadge(target))
    }
}
