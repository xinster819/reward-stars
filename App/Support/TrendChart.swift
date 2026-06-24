import SwiftUI
import Charts
import RewardCore

/// 每日净得分柱状趋势图（好/坏用颜色区分）。家长与孩子端共用。
struct TrendChart: View {
    var trend: [DailyScore]
    var height: CGFloat = 170

    var body: some View {
        Chart(trend) { day in
            BarMark(
                x: .value("日期", day.date, unit: .day),
                y: .value("分数", day.net)
            )
            .foregroundStyle(day.net >= 0 ? Theme.positive : Theme.negative)
            .cornerRadius(4)
        }
        .frame(height: height)
        .chartXAxis {
            AxisMarks(values: .stride(by: .day)) { _ in
                AxisGridLine()
                AxisValueLabel(format: .dateTime.weekday(.narrow))
            }
        }
    }
}
