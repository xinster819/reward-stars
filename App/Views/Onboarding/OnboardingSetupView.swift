import SwiftUI
import SwiftData

/// 首启必填设置：孩子名 + 家长 PIN（复用 RewardRepository.renameChild / RoleManager.configurePIN）。
struct OnboardingSetupView: View {
    var onDone: () -> Void
    @Environment(\.modelContext) private var modelContext
    @Environment(RoleManager.self) private var role

    @State private var name = ""
    @State private var pin = ""
    @State private var confirm = ""
    @State private var error: String?

    private var isValid: Bool { OnboardingSetup.isValid(name: name, pin: pin, confirm: confirm) }

    var body: some View {
        NavigationStack {
            Form {
                Section("孩子的名字") {
                    TextField("给孩子取个名字", text: $name)
                }
                Section("家长 PIN（4 位数字）") {
                    SecureField("输入 PIN", text: $pin).keyboardType(.numberPad)
                        .onChange(of: pin) { _, new in
                            let s = OnboardingSetup.sanitizedPIN(new); if s != new { pin = s }
                        }
                    SecureField("再次输入", text: $confirm).keyboardType(.numberPad)
                        .onChange(of: confirm) { _, new in
                            let s = OnboardingSetup.sanitizedPIN(new); if s != new { confirm = s }
                        }
                }
                if let error {
                    Text(error).foregroundStyle(.red).font(.caption)
                }
            }
            .navigationTitle("开始设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("开始", action: start).disabled(!isValid)
                }
            }
            // 不预填：留空 + 占位「给孩子取个名字」，使"名字必填"真正生效（避免接受默认占位名）。
        }
    }

    private func start() {
        guard isValid else { return }
        // 先写 PIN（易失败的 Keychain 操作）；成功后再改名 + 完成，避免 PIN 失败却留下改名副作用。
        do {
            try role.configurePIN(pin)
        } catch {
            self.error = "保存失败，请重试"
            return
        }
        RewardRepository(context: modelContext).renameChild(name)
        onDone()
    }
}
