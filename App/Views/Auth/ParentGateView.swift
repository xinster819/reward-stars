import SwiftUI

/// 家长门禁：输入 PIN 或用生物识别解锁家长权限。防止孩子自行切换。
/// 仅负责"校验"；校验通过调用 onAuthenticated()，由父视图关闭弹窗并随后切换角色。
struct ParentGateView: View {
    var onAuthenticated: () -> Void

    @Environment(RoleManager.self) private var role
    @Environment(\.dismiss) private var dismiss
    @State private var entered = ""
    @State private var showError = false
    @State private var failedAttempts = 0
    @State private var lockedOut = false

    private let pinLength = 4
    private let maxAttempts = 5
    private let lockoutSeconds = 30

    var body: some View {
        NavigationStack {
            VStack(spacing: 28) {
                Spacer()

                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(Theme.accent)

                Text("家长验证")
                    .font(.title2.bold())
                Text("请输入家长 PIN 进入管理界面")
                    .font(.callout)
                    .foregroundStyle(.secondary)

                pinDots
                    .modifier(ShakeEffect(animatableData: showError ? 1 : 0))

                if lockedOut {
                    Text("尝试次数过多，请 \(lockoutSeconds) 秒后再试")
                        .font(.callout).foregroundStyle(.red)
                }

                if BiometricAuth.canEvaluate() {
                    Button {
                        Task { await unlockBiometric() }
                    } label: {
                        Label("使用 \(BiometricAuth.displayName())", systemImage: "faceid")
                            .font(.callout.weight(.semibold))
                    }
                    .buttonStyle(.bordered)
                }

                Spacer()
                PINPad(onDigit: append, onDelete: deleteLast)
                    .padding(.horizontal)
                    .disabled(lockedOut)
                    .opacity(lockedOut ? 0.4 : 1)
                Spacer(minLength: 8)
            }
            .padding()
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
            }
        }
    }

    private var pinDots: some View {
        HStack(spacing: 18) {
            ForEach(0..<pinLength, id: \.self) { index in
                Circle()
                    .fill(index < entered.count ? Theme.accent : Color(.systemGray4))
                    .frame(width: 18, height: 18)
            }
        }
    }

    private func append(_ digit: String) {
        guard !lockedOut, entered.count < pinLength else { return }
        entered.append(digit)
        if entered.count == pinLength { verify() }
    }

    private func deleteLast() {
        if !entered.isEmpty { entered.removeLast() }
    }

    private func verify() {
        if role.verify(pin: entered) {
            onAuthenticated()
        } else {
            failedAttempts += 1
            withAnimation { showError = true }
            entered = ""
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { showError = false }
            #if canImport(UIKit)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            if failedAttempts >= maxAttempts { startLockout() }
        }
    }

    /// 连续输错达上限后短暂锁定键盘，缓解暴力猜测。
    private func startLockout() {
        lockedOut = true
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(lockoutSeconds))
            lockedOut = false
            failedAttempts = 0
        }
    }

    private func unlockBiometric() async {
        if await role.authenticateBiometrics() {
            onAuthenticated()
        }
    }
}

/// 数字键盘。
struct PINPad: View {
    var onDigit: (String) -> Void
    var onDelete: () -> Void

    private let keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"]
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 3)

    var body: some View {
        LazyVGrid(columns: columns, spacing: 12) {
            ForEach(keys, id: \.self) { key in
                switch key {
                case "":
                    Color.clear.frame(height: 60)
                case "⌫":
                    Button(action: onDelete) {
                        Image(systemName: "delete.left")
                            .font(.title2)
                            .frame(maxWidth: .infinity, minHeight: 60)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("pinKey-delete")
                default:
                    Button { onDigit(key) } label: {
                        Text(key)
                            .font(.title.weight(.medium))
                            .frame(maxWidth: .infinity, minHeight: 60)
                            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("pinKey-\(key)")
                }
            }
        }
        .frame(maxWidth: 360)
    }
}

/// 输错时的抖动效果。
struct ShakeEffect: GeometryEffect {
    var animatableData: CGFloat
    func effectValue(size: CGSize) -> ProjectionTransform {
        let translation = 10 * sin(animatableData * .pi * 4)
        return ProjectionTransform(CGAffineTransform(translationX: translation, y: 0))
    }
}
