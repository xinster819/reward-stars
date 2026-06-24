import SwiftUI
import SwiftData
import RewardCore

/// 家长记分：按规则一键记一次分；长按可带备注；顶部横幅可立即撤销。
struct ScoreEntryView: View {
    @Environment(\.modelContext) private var modelContext
    private var repo: RewardRepository { RewardRepository(context: modelContext) }

    @Query(sort: \RuleModel.sortOrder) private var ruleModels: [RuleModel]
    @Query private var eventModels: [EventModel]
    @Query private var redemptionModels: [RedemptionModel]

    @State private var noteRule: RuleModel?
    @State private var banner: String?
    @State private var bannerToken = UUID()

    private var activeRules: [RuleModel] { ruleModels.filter { $0.isActive } }
    private var rewardRules: [RuleModel] { activeRules.filter { $0.points >= 0 } }
    private var penaltyRules: [RuleModel] { activeRules.filter { $0.points < 0 } }
    private var balance: Int {
        ScoringEngine.balance(events: eventModels.map { $0.toDomain() },
                              redemptions: redemptionModels.map { $0.toDomain() })
    }
    private let columns = [GridItem(.adaptive(minimum: 160), spacing: 12)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    balanceHeader
                    ruleSection(title: "加分", systemImage: "plus.circle.fill", tint: Theme.positive, rules: rewardRules)
                    ruleSection(title: "扣分", systemImage: "minus.circle.fill", tint: Theme.negative, rules: penaltyRules)
                    if activeRules.isEmpty {
                        EmptyHint(systemImage: "checklist", text: "还没有启用的规则，请到「规则」页添加")
                    }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("记分")
            .safeAreaInset(edge: .top) { bannerView }
            .sheet(item: $noteRule) { rule in
                NoteEntryView(ruleName: rule.name, points: rule.points) { note in
                    record(rule, note: note)
                }
            }
            .task(id: bannerToken) {
                guard banner != nil else { return }
                try? await Task.sleep(for: .seconds(3))
                if !Task.isCancelled { withAnimation { banner = nil } }
            }
        }
    }

    private var balanceHeader: some View {
        HStack {
            Image(systemName: "star.circle.fill").foregroundStyle(Theme.accent)
            Text("当前总分 \(balance)").font(.headline)
            Spacer()
        }
    }

    @ViewBuilder private func ruleSection(title: String, systemImage: String, tint: Color, rules: [RuleModel]) -> some View {
        if !rules.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Label(title, systemImage: systemImage).font(.headline).foregroundStyle(tint)
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(rules) { rule in
                        RuleTile(rule: rule.toDomain()) { record(rule, note: nil) }
                            .contextMenu {
                                Button { noteRule = rule } label: {
                                    Label("带备注记一次…", systemImage: "text.bubble")
                                }
                            }
                    }
                }
            }
        }
    }

    @ViewBuilder private var bannerView: some View {
        if let banner {
            HStack {
                Image(systemName: "checkmark.circle.fill")
                Text(banner).lineLimit(1)
                Spacer()
                Button("撤销") {
                    repo.undoLastEvent()
                    self.banner = nil
                }
                .font(.callout.bold())
            }
            .padding(12)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    private func record(_ rule: RuleModel, note: String?) {
        guard repo.recordScore(ruleID: rule.id, note: note) else { return }
        withAnimation { banner = "已记录 \(Theme.pointText(rule.points))  \(rule.name)" }
        bannerToken = UUID()   // 重置自动消失计时（.task(id:) 会取消上一次）
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        #endif
    }
}

/// 单条规则按钮。
struct RuleTile: View {
    var rule: BehaviorRule
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: rule.iconName)
                    .font(.system(size: 28))
                    .foregroundStyle(.white)
                    .frame(width: 56, height: 56)
                    .background(Theme.color(for: rule.category).gradient, in: Circle())
                Text(rule.name).font(.subheadline.weight(.medium))
                    .multilineTextAlignment(.center).lineLimit(2)
                PointPill(points: rule.points)
            }
            .frame(maxWidth: .infinity, minHeight: 150)
            .padding(.vertical, 8)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }
}

/// 备注输入弹窗。
struct NoteEntryView: View {
    var ruleName: String
    var points: Int
    var onSave: (String?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var note = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("行为") {
                    HStack { Text(ruleName); Spacer(); PointPill(points: points) }
                }
                Section("备注（可选）") {
                    TextField("例如：主动帮妈妈摆碗筷", text: $note, axis: .vertical)
                        .lineLimit(1...4)
                }
            }
            .navigationTitle("记一次分")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("记一次") {
                        onSave(note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : note)
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}
