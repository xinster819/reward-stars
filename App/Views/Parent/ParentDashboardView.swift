import SwiftUI
import SwiftData
import RewardCore

/// 家长端总览：关键指标 + 待审批兑换 + 趋势 + 最近记录（可撤销）。
struct ParentDashboardView: View {
    @Environment(\.modelContext) private var modelContext
    private var repo: RewardRepository { RewardRepository(context: modelContext) }
    @Environment(RoleManager.self) private var role

    @Query(sort: \EventModel.timestamp, order: .reverse) private var eventModels: [EventModel]
    @Query(sort: \RedemptionModel.requestedAt, order: .reverse) private var redemptionModels: [RedemptionModel]
    @Query private var childModels: [ChildModel]

    @State private var showingSettings = false
    @State private var pendingExit = false

    private var summary: ScoreSummary {
        ScoreSummary(events: eventModels.map { $0.toDomain() },
                     redemptions: redemptionModels.map { $0.toDomain() })
    }
    private var pending: [RedemptionRequest] {
        redemptionModels.map { $0.toDomain() }.filter { $0.status == .pending }
    }
    private var child: ChildModel? { childModels.first }
    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 12)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    statsGrid
                    if !pending.isEmpty { pendingCard }
                    trendCard
                    recentCard
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle(child.map { "\($0.name)的总览" } ?? "总览")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showingSettings = true } label: { Image(systemName: "gearshape.fill") }
                        .accessibilityIdentifier("settingsButton")
                }
            }
            .sheet(isPresented: $showingSettings, onDismiss: {
                if pendingExit {
                    pendingExit = false
                    role.switchToChild()
                }
            }) {
                ParentSettingsView(onExit: {
                    pendingExit = true
                    showingSettings = false
                })
            }
        }
    }

    private var statsGrid: some View {
        LazyVGrid(columns: columns, spacing: 12) {
            StatTile(title: "当前总分", value: "\(summary.balance)", systemImage: "star.circle.fill", tint: Theme.accent)
            StatTile(title: "本周净得", value: Theme.pointText(summary.weeklyNet), systemImage: "calendar", tint: .blue)
            StatTile(title: "连击天数", value: "\(summary.streak)", systemImage: "flame.fill", tint: .orange)
            StatTile(title: "待审批", value: "\(pending.count)", systemImage: "clock.badge.exclamationmark", tint: .red)
        }
    }

    private var pendingCard: some View {
        SectionCard("待审批兑换", systemImage: "clock.badge.checkmark") {
            PendingApprovalsList(pending: pending, balance: summary.balance)
        }
    }

    private var trendCard: some View {
        SectionCard("近 \(AppConfig.trendDays) 天趋势", systemImage: "chart.bar.xaxis") {
            TrendChart(trend: summary.trend)
        }
    }

    private var recentCard: some View {
        SectionCard("最近记录", systemImage: "clock.fill") {
            if summary.recent.isEmpty {
                EmptyHint(systemImage: "tray", text: "还没有记录")
            } else {
                VStack(spacing: 0) {
                    ForEach(summary.recent) { event in
                        EventRow(event: event)
                        if event.id != summary.recent.last?.id { Divider() }
                    }
                }
                Button(role: .destructive) {
                    repo.undoLastEvent()
                } label: {
                    Label("撤销最近一次记分", systemImage: "arrow.uturn.backward")
                }
                .padding(.top, 4)
            }
        }
    }
}

/// 待审批兑换列表（家长通过/驳回）。家长端多处复用。
/// balance 用于即时标注哪些奖励当前积分不足（不可通过）。
struct PendingApprovalsList: View {
    @Environment(\.modelContext) private var modelContext
    private var repo: RewardRepository { RewardRepository(context: modelContext) }
    var pending: [RedemptionRequest]
    var balance: Int

    var body: some View {
        VStack(spacing: 0) {
            ForEach(pending) { req in
                let affordable = balance >= req.cost
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(req.rewardName).font(.body)
                        if affordable {
                            Text("\(req.cost) 分 · \(req.requestedAt, format: .dateTime.month().day().hour().minute())")
                                .font(.caption).foregroundStyle(.secondary)
                        } else {
                            Text("积分不足（需 \(req.cost)，余 \(balance)）")
                                .font(.caption).foregroundStyle(.red)
                        }
                    }
                    Spacer()
                    Button {
                        repo.rejectRedemption(id: req.id)
                    } label: {
                        Image(systemName: "xmark.circle.fill").font(.title2).foregroundStyle(.red)
                    }
                    .buttonStyle(.plain)
                    Button {
                        repo.approveRedemption(id: req.id)
                    } label: {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.title2)
                            .foregroundStyle(affordable ? .green : .gray)
                    }
                    .buttonStyle(.plain)
                    .disabled(!affordable)
                }
                .padding(.vertical, 8)
                if req.id != pending.last?.id { Divider() }
            }
        }
    }
}
