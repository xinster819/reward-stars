import Foundation

/// 某一天的净得分（趋势图用）。date 为当天 00:00。
public struct DailyScore: Identifiable, Equatable, Sendable {
    public let date: Date
    public let net: Int
    public var id: Date { date }

    public init(date: Date, net: Int) {
        self.date = date
        self.net = net
    }
}
