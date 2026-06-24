import SwiftUI
import SwiftData
import RewardCore

/// 孩子端首页：大号总分 + 本周进度 + 连击 + 下一目标 + 徽章 + 最近表现。鼓励为主。
struct ChildDashboardView: View {
    var onRequestParent: () -> Void

    @Environment(\.modelContext) private var modelContext
    private var repo: RewardRepository { RewardRepository(context: modelContext) }

    @Query(sort: \EventModel.timestamp, order: .reverse) private var eventModels: [EventModel]
    @Query private var redemptionModels: [RedemptionModel]
    @Query private var childModels: [ChildModel]

    private var summary: ScoreSummary {
        ScoreSummary(events: eventModels.map { $0.toDomain() },
                     redemptions: redemptionModels.map { $0.toDomain() })
    }
    private var child: ChildModel? { childModels.first }
    private var weeklyFraction: Double {
        min(1, max(0, Double(summary.weeklyNet) / Double(AppConfig.weeklyGoal)))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    greetingHeader
                    balanceCard
                    milestoneCard
                    badgesCard
                    recentCard
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("我的积分")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: onRequestParent) {
                        Image(systemName: "lock.fill")
                    }
                    .accessibilityLabel("家长入口")
                    .accessibilityIdentifier("parentLockButton")
                }
            }
        }
    }

    @ViewBuilder private var greetingHeader: some View {
        if let child {
            HStack(spacing: 14) {
                AvatarPicker(childID: child.id, symbol: child.avatarSymbol, size: 64) { marker in
                    repo.setAvatar(marker)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("你好，\(child.name)！").font(.title2.bold())
                    Text("点头像可换照片").font(.callout).foregroundStyle(.secondary)
                }
                Spacer()
            }
        }
    }

    private var balanceCard: some View {
        SectionCard {
            HStack(spacing: 20) {
                ZStack {
                    ProgressRing(progress: weeklyFraction, lineWidth: 14)
                        .frame(width: 124, height: 124)
                    VStack(spacing: 0) {
                        Text("\(summary.balance)")
                            .font(.system(size: 42, weight: .heavy, design: .rounded))
                            .foregroundStyle(Theme.accent)
                            .contentTransition(.numericText())
                        Text("总分").font(.caption).foregroundStyle(.secondary)
                    }
                }
                VStack(alignment: .leading, spacing: 10) {
                    Label("本周 \(max(0, summary.weeklyNet)) / \(AppConfig.weeklyGoal) 分", systemImage: "calendar")
                        .foregroundStyle(.blue)
                    Label("连续 \(summary.streak) 天表现棒", systemImage: "flame.fill")
                        .foregroundStyle(.orange)
                    Label("已获 \(summary.badges.count) 枚徽章", systemImage: "rosette")
                        .foregroundStyle(.pink)
                }
                .font(.callout.weight(.medium))
                Spacer(minLength: 0)
            }
        }
    }

    @ViewBuilder private var milestoneCard: some View {
        if let m = summary.nextMilestone {
            SectionCard("下一个目标", systemImage: "target") {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: m.badge.iconName).foregroundStyle(Theme.accent)
                        Text(m.badge.localizedTitle).font(.headline)
                        Spacer()
                        Text("\(m.current) / \(m.target)").foregroundStyle(.secondary)
                    }
                    ProgressView(value: m.fraction).tint(Theme.accent)
                    Text("再得 \(m.remaining) 分就能解锁啦！")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        } else {
            SectionCard("全部目标达成", systemImage: "crown.fill") {
                Text("太厉害啦，所有里程碑都拿到了 🎉").font(.callout)
            }
        }
    }

    private var badgesCard: some View {
        SectionCard("我的徽章", systemImage: "rosette") {
            if summary.badges.isEmpty {
                EmptyHint(systemImage: "rosette", text: "还没有徽章，继续加油就能拿到！")
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(summary.badges) { BadgeChip(badge: $0) }
                    }
                }
            }
        }
    }

    private var recentCard: some View {
        SectionCard("最近表现", systemImage: "clock.fill") {
            if summary.recent.isEmpty {
                EmptyHint(systemImage: "tray", text: "还没有记录")
            } else {
                VStack(spacing: 0) {
                    ForEach(summary.recent) { event in
                        EventRow(event: event)
                        if event.id != summary.recent.last?.id { Divider() }
                    }
                }
            }
        }
    }
}
