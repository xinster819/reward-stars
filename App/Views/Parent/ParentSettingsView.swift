import SwiftUI
import SwiftData
import RewardCore

/// 家长设置：修改 PIN、生物识别说明、重置示例数据、退出家长模式。
/// 退出家长由父视图在弹窗关闭后处理（onExit），避免"切换宿主 + 关弹窗"同帧竞态。
struct ParentSettingsView: View {
    var onExit: () -> Void

    @Environment(\.modelContext) private var modelContext
    private var repo: RewardRepository { RewardRepository(context: modelContext) }
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var showResetConfirm = false
    @State private var showChangePIN = false
    @State private var showClearConfirm = false
    @State private var showRestoreConfirm = false
    @State private var childName = ""
    @State private var childID = ChildProfile.sampleChildID
    @State private var avatarSymbol = ""
    @State private var backupMsg: String?

    var body: some View {
        NavigationStack {
            Form {
                childSection
                securitySection
                scoreSection
                backupSection
                dataSection
                exitSection
                aboutSection
            }
            .navigationTitle("家长设置")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                let child = repo.child()
                childName = child?.name ?? ""
                childID = child?.id ?? ChildProfile.sampleChildID
                avatarSymbol = child?.avatarSymbol ?? ""
            }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { saveName(); dismiss() }
                }
            }
            .alert("积分清零？", isPresented: $showClearConfirm) {
                Button("取消", role: .cancel) {}
                Button("清零", role: .destructive) { repo.clearScores() }
            } message: {
                Text("将清空全部记分流水与兑换记录，总分归零；规则与奖励目录保留。此操作不可撤销。")
            }
            .alert("重置为初始状态？", isPresented: $showResetConfirm) {
                Button("取消", role: .cancel) {}
                Button("重置", role: .destructive) { repo.resetAndSeed(); childName = repo.child()?.name ?? "" }
            } message: {
                Text("将清空全部记录、恢复默认规则与奖励、积分归零。此操作不可撤销。")
            }
            .alert("恢复最近备份？", isPresented: $showRestoreConfirm) {
                Button("取消", role: .cancel) {}
                Button("恢复", role: .destructive) {
                    if let bundle = DataBackup.latestJSONSnapshot() {
                        repo.importBundle(bundle, replace: true)
                        childName = repo.child()?.name ?? ""
                        backupMsg = "已从最近备份恢复"
                    } else {
                        backupMsg = "没有找到可用备份"
                    }
                }
            } message: {
                Text("将用最近一次备份覆盖当前数据。")
            }
            .sheet(isPresented: $showChangePIN) { ChangePINView() }
        }
    }

    private func saveName() {
        let trimmed = childName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            childName = repo.child()?.name ?? ""   // 还原空输入
            return
        }
        repo.renameChild(trimmed)
    }

    // MARK: - 分区（拆分以降低 SwiftUI 类型检查负担）

    private var childSection: some View {
        Section("孩子") {
            HStack(spacing: 14) {
                AvatarPicker(childID: childID, symbol: avatarSymbol, size: 56) { marker in
                    repo.setAvatar(marker)
                    avatarSymbol = marker
                }
                TextField("孩子名字", text: $childName).onSubmit(saveName)
            }
        }
    }

    private var securitySection: some View {
        Section("家长安全") {
            Button { showChangePIN = true } label: {
                Label("修改家长 PIN", systemImage: "key.fill")
            }
            HStack {
                Label("生物识别", systemImage: "faceid")
                Spacer()
                Text(BiometricAuth.canEvaluate() ? "可用（\(BiometricAuth.displayName())）" : "不可用")
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var scoreSection: some View {
        Section("积分") {
            Button(role: .destructive) { showClearConfirm = true } label: {
                Label("积分清零", systemImage: "0.circle")
            }
        }
    }

    private var backupSection: some View {
        Section {
            Button {
                backupMsg = DataBackup.writeJSONSnapshot(repo.exportBundle()) != nil
                    ? "已备份（可在「文件」App → 行为奖励 → Backups 查看）"
                    : "备份失败，请重试"
            } label: {
                Label("立即备份数据", systemImage: "externaldrive.badge.timemachine")
            }
            Button { showRestoreConfirm = true } label: {
                Label("恢复最近备份", systemImage: "arrow.uturn.backward.circle")
            }
        } header: {
            Text("数据备份")
        } footer: {
            Text(backupMsg ?? "每次启动自动备份；升级新版本会自动迁移并保留全部历史记录。备份文件存于「文件」App 的「行为奖励 → Backups」。")
                .foregroundStyle(backupMsg == nil ? Color.secondary : Color.green)
        }
    }

    private var dataSection: some View {
        Section("数据") {
            Button(role: .destructive) { showResetConfirm = true } label: {
                Label("重置为初始状态", systemImage: "arrow.counterclockwise")
            }
        }
    }

    private var exitSection: some View {
        Section {
            Button { onExit() } label: {
                Label("退出家长模式", systemImage: "rectangle.portrait.and.arrow.right")
            }
        } footer: {
            Text("退出后回到孩子（只读）界面。再次进入家长界面需输入 PIN。")
        }
    }

    private var aboutSection: some View {
        Section("关于") {
            LabeledContent("版本", value: "1.0")
            NavigationLink {
                PrivacyView()
            } label: {
                Label("隐私政策", systemImage: "hand.raised.fill")
            }
            Button {
                if let url = URL(string: "mailto:\(AppConfig.contactEmail)") { openURL(url) }
            } label: {
                HStack {
                    Label("联系我们", systemImage: "envelope.fill")
                    Spacer()
                    Text(verbatim: AppConfig.contactEmail)
                        .font(.callout).foregroundStyle(.secondary)
                }
            }
            Text("第一版仅管理一个孩子，全部数据离线存储在本机。")
                .font(.caption).foregroundStyle(.secondary)
        }
    }
}

/// 修改家长 PIN：输入两次新 PIN 确认。
struct ChangePINView: View {
    @Environment(RoleManager.self) private var role
    @Environment(\.dismiss) private var dismiss

    @State private var newPIN = ""
    @State private var confirmPIN = ""
    @State private var error: String?

    private var isValid: Bool {
        newPIN.count == 4 && newPIN.allSatisfy(\.isNumber) && newPIN == confirmPIN
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("新 PIN（4 位数字）") {
                    SecureField("输入新 PIN", text: $newPIN)
                        .keyboardType(.numberPad)
                        .onChange(of: newPIN) { _, new in
                            let s = OnboardingSetup.sanitizedPIN(new); if s != new { newPIN = s }
                        }
                    SecureField("再次输入", text: $confirmPIN)
                        .keyboardType(.numberPad)
                        .onChange(of: confirmPIN) { _, new in
                            let s = OnboardingSetup.sanitizedPIN(new); if s != new { confirmPIN = s }
                        }
                }
                if let error {
                    Text(error).foregroundStyle(.red).font(.caption)
                }
            }
            .navigationTitle("修改 PIN")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存", action: save).disabled(!isValid)
                }
            }
        }
    }

    private func save() {
        guard isValid else { return }
        do {
            try role.configurePIN(newPIN)
            dismiss()
        } catch {
            self.error = "保存失败，请重试"
        }
    }
}
