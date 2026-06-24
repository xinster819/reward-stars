import Foundation

/// 首启引导的纯输入校验（无 UI/持久化依赖，便于离线确定性测试）。
enum OnboardingSetup {
    /// 孩子名去空白后非空；PIN 规则与 ChangePINView 一致：4 位数字、两次一致。
    static func isValid(name: String, pin: String, confirm: String) -> Bool {
        let nameOK = !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let pinOK = pin.count == 4 && pin.allSatisfy(\.isNumber) && pin == confirm
        return nameOK && pinOK
    }

    /// 实时规整 PIN 输入：仅保留数字、最多 4 位（防止多填/非数字）。供 SecureField 的 onChange 用。
    static func sanitizedPIN(_ raw: String) -> String {
        String(raw.filter(\.isNumber).prefix(4))
    }
}

/// 首启门禁初值判定。
enum OnboardingGate {
    /// 新安装（空库）需引导 → false；已有数据的升级用户 → 跳过 → true。
    static func initialHasSeen(freshInstall: Bool) -> Bool { !freshInstall }
}
