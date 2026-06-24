import Foundation
import Observation

/// 应用角色。默认 child（只读），家长需通过 PIN / 生物识别解锁。
enum AppRole: String {
    case parent
    case child
}

/// 角色与家长鉴权状态。
@MainActor
@Observable
final class RoleManager {
    private(set) var role: AppRole = .child
    @ObservationIgnored private let pinStore: PINStoring

    init(pinStore: PINStoring) {
        self.pinStore = pinStore
    }

    var isPINConfigured: Bool { pinStore.isPINSet }

    /// 首次设置或修改家长 PIN。
    func configurePIN(_ pin: String) throws {
        try pinStore.setPIN(pin)
    }

    /// 仅校验 PIN，不改变角色。
    func verify(pin: String) -> Bool {
        pinStore.verify(pin)
    }

    /// Face ID / Touch ID 校验，不改变角色。
    func authenticateBiometrics(reason: String = "解锁家长管理权限") async -> Bool {
        await BiometricAuth.authenticate(reason: reason)
    }

    /// 切换到家长。注意：应在门禁界面已关闭后再调用，
    /// 避免"切换宿主视图树 + 关闭弹窗"在同一帧发生导致的呈现态竞态。
    func enterParent() {
        role = .parent
    }

    /// 校验 PIN 并立即进入家长（保留给单测 / 非门禁场景，如 DEBUG 启动钩子）。
    @discardableResult
    func unlockParent(pin: String) -> Bool {
        guard verify(pin: pin) else { return false }
        enterParent()
        return true
    }

    /// 退回孩子（只读）模式。
    func switchToChild() {
        role = .child
    }
}
