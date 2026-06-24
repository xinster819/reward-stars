import Foundation

/// 一套示例数据（一个孩子 + 规则 + 奖励 + 流水），用于首启 seed 与 SwiftUI 预览。
public struct SampleBundle: Sendable {
    public let child: ChildProfile
    public let rules: [BehaviorRule]
    public let rewards: [Reward]
    public let events: [ScoreEvent]
    public let redemptions: [RedemptionRequest]

    public init(
        child: ChildProfile,
        rules: [BehaviorRule],
        rewards: [Reward],
        events: [ScoreEvent],
        redemptions: [RedemptionRequest]
    ) {
        self.child = child
        self.rules = rules
        self.rewards = rewards
        self.events = events
        self.redemptions = redemptions
    }
}

public enum SampleData {

    /// 生成示例数据。`now` 注入便于测试与确定性；流水分布在最近一周。
    public static func make(
        now: Date = Date(),
        childID: UUID = ChildProfile.sampleChildID
    ) -> SampleBundle {
        let child = ChildProfile(
            id: childID, name: "小明", avatarSymbol: "teddybear.fill",
            createdAt: now.addingTimeInterval(-30 * 86_400))

        // MARK: 规则（覆盖四类，含奖励与惩罚）
        let rHomework = BehaviorRule(name: "认真完成作业", category: .learning, points: 10, iconName: "pencil.and.ruler.fill", sortOrder: 0, childID: childID)
        let rReading  = BehaviorRule(name: "主动阅读 30 分钟", category: .learning, points: 8, iconName: "book.fill", sortOrder: 1, childID: childID)
        let rTidy     = BehaviorRule(name: "自己整理房间", category: .life, points: 5, iconName: "bed.double.fill", sortOrder: 2, childID: childID)
        let rRoutine  = BehaviorRule(name: "按时起床睡觉", category: .life, points: 5, iconName: "alarm.fill", sortOrder: 3, childID: childID)
        let rChores   = BehaviorRule(name: "帮忙做家务", category: .life, points: 6, iconName: "hands.sparkles.fill", sortOrder: 4, childID: childID)
        let rPolite   = BehaviorRule(name: "有礼貌、主动分享", category: .character, points: 6, iconName: "heart.fill", sortOrder: 5, childID: childID)
        let rDelay    = BehaviorRule(name: "拖延磨蹭", category: .learning, points: -5, iconName: "tortoise.fill", sortOrder: 6, childID: childID)
        let rRude     = BehaviorRule(name: "顶撞父母", category: .character, points: -8, iconName: "exclamationmark.bubble.fill", sortOrder: 7, childID: childID)
        let rExtra    = BehaviorRule(name: "其他好表现", category: .other, points: 4, iconName: "star.fill", sortOrder: 8, childID: childID)
        let rules = [rHomework, rReading, rTidy, rRoutine, rChores, rPolite, rDelay, rRude, rExtra]

        // MARK: 奖励目录
        let rewards = [
            Reward(name: "看 30 分钟电视", cost: 20, iconName: "tv.fill", sortOrder: 0, childID: childID),
            Reward(name: "玩 30 分钟游戏", cost: 25, iconName: "gamecontroller.fill", sortOrder: 1, childID: childID),
            Reward(name: "一支冰淇淋", cost: 15, iconName: "birthday.cake.fill", sortOrder: 2, childID: childID),
            Reward(name: "挑一本新书", cost: 40, iconName: "books.vertical.fill", sortOrder: 3, childID: childID),
            Reward(name: "周末去公园", cost: 50, iconName: "tree.fill", sortOrder: 4, childID: childID)
        ]

        // MARK: 流水（最近一周，每天均有正分，营造连击与上升趋势）
        // 锚定到各自然日的 hour 点；今天的事件若落到 now 之后则收敛到 now 之前几分钟，
        // 保证任何启动时刻/时区下流水都不会出现在未来。
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: now)
        func ev(_ rule: BehaviorRule, daysAgo: Int, hour: Int, note: String? = nil) -> ScoreEvent {
            let base = calendar.date(byAdding: .day, value: -daysAgo, to: today) ?? today
            var ts = calendar.date(byAdding: .hour, value: hour, to: base) ?? base
            if ts > now { ts = now.addingTimeInterval(-Double(hour) * 60) }
            return ScoreEvent(ruleID: rule.id, ruleName: rule.name, category: rule.category,
                              points: rule.points, note: note, timestamp: ts, childID: childID)
        }
        let events = [
            ev(rHomework, daysAgo: 6, hour: 19),
            ev(rTidy,     daysAgo: 6, hour: 20),
            ev(rReading,  daysAgo: 5, hour: 18),
            ev(rDelay,    daysAgo: 4, hour: 17, note: "作业拖到很晚"),
            ev(rChores,   daysAgo: 4, hour: 19),
            ev(rHomework, daysAgo: 3, hour: 19),
            ev(rPolite,   daysAgo: 2, hour: 9, note: "主动和邻居打招呼"),
            ev(rRoutine,  daysAgo: 2, hour: 21),
            ev(rHomework, daysAgo: 1, hour: 19),
            ev(rReading,  daysAgo: 1, hour: 20),
            ev(rTidy,     daysAgo: 0, hour: 8),
            ev(rChores,   daysAgo: 0, hour: 18, note: "帮忙摆碗筷")
        ]

        return SampleBundle(child: child, rules: rules, rewards: rewards,
                            events: events, redemptions: [])
    }
}
