import SwiftUI
import SwiftData
import RewardCore

/// 家长历史与统计：趋势、分类净得、全部流水（可撤销最近一次）。
struct HistoryView: View {
    @Environment(\.modelContext) private var modelContext
    private var repo: RewardRepository { RewardRepository(context: modelContext) }
    @Query(sort: \EventModel.timestamp, order: .reverse) private var eventModels: [EventModel]

    enum Filter: String, CaseIterable, Identifiable {
        case all = "全部", positive = "加分", negative = "扣分"
        var id: String { rawValue }
    }
    @State private var filter: Filter = .all

    private var allDomain: [ScoreEvent] { eventModels.map { $0.toDomain() } }
    private var active: [ScoreEvent] { allDomain.filter { !$0.isVoided } }
    private var trend: [DailyScore] {
        ScoringEngine.dailyNetTotals(events: allDomain, days: AppConfig.trendDays, endingOn: Date())
    }
    private var filtered: [ScoreEvent] {
        switch filter {
        case .all: return active
        case .positive: return active.filter { $0.points >= 0 }
        case .negative: return active.filter { $0.points < 0 }
        }
    }
    private var categoryNet: [(ScoreCategory, Int)] {
        ScoreCategory.allCases.map { c in
            (c, active.filter { $0.category == c }.reduce(0) { $0 + $1.points })
        }
    }
    private var canUndo: Bool { ScoringEngine.lastUndoableEvent(events: allDomain) != nil }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    SectionCard("近 \(AppConfig.trendDays) 天趋势", systemImage: "chart.bar.xaxis") {
                        TrendChart(trend: trend)
                    }
                    categoryCard
                    recordsCard
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("历史与统计")
        }
    }

    private var categoryCard: some View {
        SectionCard("分类净得", systemImage: "square.grid.2x2") {
            VStack(spacing: 10) {
                ForEach(categoryNet, id: \.0) { category, net in
                    HStack {
                        CategoryChip(category: category)
                        Spacer()
                        Text(Theme.pointText(net))
                            .font(.subheadline.bold())
                            .foregroundStyle(Theme.pointColor(net))
                    }
                }
            }
        }
    }

    private var recordsCard: some View {
        SectionCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label("全部流水", systemImage: "list.bullet").font(.headline)
                    Spacer()
                    Button {
                        repo.undoLastEvent()
                    } label: {
                        Label("撤销最近", systemImage: "arrow.uturn.backward")
                            .font(.caption.weight(.semibold))
                    }
                    .disabled(!canUndo)
                }
                Picker("筛选", selection: $filter) {
                    ForEach(Filter.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)

                if filtered.isEmpty {
                    EmptyHint(systemImage: "tray", text: "没有记录")
                } else {
                    VStack(spacing: 0) {
                        ForEach(filtered) { event in
                            EventRow(event: event)
                            if event.id != filtered.last?.id { Divider() }
                        }
                    }
                }
            }
        }
    }
}
