import Foundation
import LocalAuthentication

/// Face ID / Touch ID 封装。不可用或失败时由调用方回退到 PIN。
enum BiometricAuth {

    /// 当前设备的生物识别类型（无 / Touch ID / Face ID / Optic ID）。
    static func availableType() -> LABiometryType {
        let context = LAContext()
        // 必须先 canEvaluatePolicy 才能让 biometryType 生效，勿删此调用。
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        return context.biometryType
    }

    static func canEvaluate() -> Bool {
        LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
    }

    /// 友好名称，用于按钮文案。
    static func displayName() -> String {
        switch availableType() {
        case .faceID:  return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        default:       return "生物识别"
        }
    }

    static func authenticate(reason: String) async -> Bool {
        let context = LAContext()
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else {
            return false
        }
        do {
            return try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics, localizedReason: reason)
        } catch {
            return false
        }
    }
}
