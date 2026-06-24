import SwiftUI
import SwiftData
import RewardCore

/// 孩子端奖励商店：看能兑换什么、还差多少分；兑换需家长确认。
struct ChildStoreView: View {
    @Environment(\.modelContext) private var modelContext
    private var repo: RewardRepository { RewardRepository(context: modelContext) }

    @Query(sort: \RewardModel.sortOrder) private var rewardModels: [RewardModel]
    @Query private var eventModels: [EventModel]
    @Query(sort: \RedemptionModel.requestedAt, order: .reverse) private var redemptionModels: [RedemptionModel]

    private var balance: Int {
        ScoringEngine.balance(events: eventModels.map { $0.toDomain() },
                              redemptions: redemptionModels.map { $0.toDomain() })
    }
    private var rewards: [Reward] { rewardModels.filter { $0.isActive }.map { $0.toDomain() } }
    private var redemptions: [RedemptionRequest] { redemptionModels.map { $0.toDomain() } }

    private func isPending(_ rewardID: UUID) -> Bool {
        redemptions.contains { $0.rewardID == rewardID && $0.status == .pending }
    }

    private let columns = [GridItem(.adaptive(minimum: 165), spacing: 14)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    balanceBanner
                    LazyVGrid(columns: columns, spacing: 14) {
                        ForEach(rewards) { reward in
                            RewardStoreCard(
                                reward: reward,
                                balance: balance,
                                pending: isPending(reward.id),
                                onRedeem: { repo.requestRedemption(rewardID: reward.id) }
                            )
                        }
                    }
                    if rewards.isEmpty {
                        EmptyHint(systemImage: "gift", text: "暂时还没有奖励")
                    }
                    requestsSection
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("奖励商店")
        }
    }

    private var balanceBanner: some View {
        HStack {
            Image(systemName: "star.circle.fill").font(.title).foregroundStyle(Theme.accent)
            Text("我有 \(balance) 分").font(.title2.bold())
            Spacer()
        }
        .padding()
        .background(Theme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder private var requestsSection: some View {
        if !redemptions.isEmpty {
            SectionCard("我的兑换申请", systemImage: "clock.badge.checkmark") {
                VStack(spacing: 0) {
                    ForEach(redemptions.prefix(8)) { request in
                        HStack {
                            Text(request.rewardName)
                            Spacer()
                            Text("\(request.cost) 分").foregroundStyle(.secondary).font(.caption)
                            RedemptionStatusChip(status: request.status)
                        }
                        .padding(.vertical, 6)
                        if request.id != redemptions.prefix(8).last?.id { Divider() }
                    }
                }
            }
        }
    }
}

/// 单个奖励卡片。
struct RewardStoreCard: View {
    var reward: Reward
    var balance: Int
    var pending: Bool
    var onRedeem: () -> Void

    private var affordable: Bool { RedemptionPolicy.canAfford(reward: reward, balance: balance) }
    private var needed: Int { RedemptionPolicy.pointsNeeded(reward: reward, balance: balance) }

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: reward.iconName)
                .font(.system(size: 34))
                .foregroundStyle(.white)
                .frame(width: 64, height: 64)
                .background((affordable ? Theme.positive : Color.gray).gradient, in: Circle())

            Text(reward.name).font(.headline).multilineTextAlignment(.center).lineLimit(2)
            Text("\(reward.cost) 分").font(.subheadline.bold()).foregroundStyle(Theme.accent)

            if pending {
                Label("等家长确认", systemImage: "hourglass")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.orange)
            } else if affordable {
                Button(action: onRedeem) {
                    Text("兑换").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.positive)
            } else {
                VStack(spacing: 4) {
                    ProgressView(value: Double(balance), total: Double(reward.cost)).tint(Theme.accent)
                    Text("还差 \(needed) 分").font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18))
    }
}

/// 兑换状态标签。
struct RedemptionStatusChip: View {
    var status: RedemptionStatus
    private var color: Color {
        switch status {
        case .pending:  return .orange
        case .approved: return .green
        case .rejected: return .red
        }
    }
    var body: some View {
        Text(status.localizedName)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }
}
