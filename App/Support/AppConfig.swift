import Foundation

/// 应用级常量（游戏化默认值见 DECISIONS D11）。
enum AppConfig {
    /// 本周目标分（孩子端进度条上限）。
    static let weeklyGoal = 100
    /// 仪表盘"最近记录"展示条数。
    static let recentEventsCount = 8
    /// 趋势图天数。
    static let trendDays = 7
    /// 演示用默认家长 PIN（首启写入，可在家长设置修改）。
    static let defaultDemoPIN = "1234"
    /// 「联系我们」邮箱（家长设置内展示；与隐私政策联系方式一致）。
    static let contactEmail = "xinster819ca@gmail.com"
}
