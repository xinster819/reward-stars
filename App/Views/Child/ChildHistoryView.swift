import SwiftUI
import SwiftData
import RewardCore
import Charts

/// 孩子端记录页（只读）：本周趋势 + 全部行为记录（好/坏用颜色区分）。
struct ChildHistoryView: View {
    @Query(sort: \EventModel.timestamp, order: .reverse) private var eventModels: [EventModel]

    private var allDomain: [ScoreEvent] { eventModels.map { $0.toDomain() } }
    private var events: [ScoreEvent] { allDomain.filter { !$0.isVoided } }
    private var trend: [DailyScore] {
        ScoringEngine.dailyNetTotals(events: allDomain, days: AppConfig.trendDays, endingOn: Date())
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    trendCard
                    recordsCard
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("我的记录")
        }
    }

    private var trendCard: some View {
        SectionCard("本周趋势", systemImage: "chart.bar.fill") {
            TrendChart(trend: trend)
        }
    }

    private var recordsCard: some View {
        SectionCard("全部记录", systemImage: "list.bullet") {
            if events.isEmpty {
                EmptyHint(systemImage: "tray", text: "还没有记录")
            } else {
                VStack(spacing: 0) {
                    ForEach(events) { event in
                        EventRow(event: event)
                        if event.id != events.last?.id { Divider() }
                    }
                }
            }
        }
    }
}
