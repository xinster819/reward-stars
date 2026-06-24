import SwiftUI
import SwiftData
import RewardCore

/// 家长规则管理：增删改查、启用/停用。
struct RulesAdminView: View {
    @Environment(\.modelContext) private var modelContext
    private var repo: RewardRepository { RewardRepository(context: modelContext) }
    @Query(sort: \RuleModel.sortOrder) private var ruleModels: [RuleModel]
    @State private var sheet: RuleSheet?

    var body: some View {
        NavigationStack {
            List {
                if ruleModels.isEmpty {
                    EmptyHint(systemImage: "checklist", text: "还没有规则，点右上角 + 添加")
                        .listRowBackground(Color.clear)
                }
                ForEach(ruleModels) { rule in
                    RuleAdminRow(
                        rule: rule.toDomain(),
                        isActive: Binding(
                            get: { rule.isActive },
                            set: { repo.setRule(id: rule.id, active: $0) }
                        ),
                        onEdit: { sheet = .edit(rule) }
                    )
                }
                .onDelete(perform: delete)
            }
            .navigationTitle("奖惩规则")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { sheet = .new } label: { Image(systemName: "plus") }
                }
            }
            .sheet(item: $sheet) { RuleEditView(sheet: $0) }
        }
    }

    private func delete(at offsets: IndexSet) {
        offsets.map { ruleModels[$0].id }.forEach { repo.deleteRule(id: $0) }
    }
}

private struct RuleAdminRow: View {
    var rule: BehaviorRule
    @Binding var isActive: Bool
    var onEdit: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: rule.iconName)
                .foregroundStyle(Theme.color(for: rule.category))
                .frame(width: 30)
            VStack(alignment: .leading, spacing: 4) {
                Text(rule.name).font(.body)
                if let detail = rule.details, !detail.isEmpty {
                    Text(detail).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                }
                HStack(spacing: 6) {
                    CategoryChip(category: rule.category)
                    PointPill(points: rule.points)
                }
            }
            Spacer()
            Toggle("", isOn: $isActive).labelsHidden()
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onEdit)
        .opacity(isActive ? 1 : 0.5)
    }
}

enum RuleSheet: Identifiable {
    case new
    case edit(RuleModel)
    var id: String {
        switch self {
        case .new: return "new"
        case .edit(let rule): return rule.id.uuidString
        }
    }
}

/// 规则新增 / 编辑表单。
struct RuleEditView: View {
    @Environment(\.modelContext) private var modelContext
    private var repo: RewardRepository { RewardRepository(context: modelContext) }
    @Environment(\.dismiss) private var dismiss
    let sheet: RuleSheet

    @State private var name: String
    @State private var category: ScoreCategory
    @State private var isPenalty: Bool
    @State private var magnitude: Int
    @State private var iconName: String
    @State private var details: String

    private let iconOptions = [
        "book.fill", "pencil.and.ruler.fill", "house.fill", "bed.double.fill",
        "alarm.fill", "hands.sparkles.fill", "heart.fill", "star.fill",
        "tortoise.fill", "exclamationmark.bubble.fill", "trophy.fill", "leaf.fill"
    ]

    init(sheet: RuleSheet) {
        self.sheet = sheet
        switch sheet {
        case .new:
            _name = State(initialValue: "")
            _category = State(initialValue: .learning)
            _isPenalty = State(initialValue: false)
            _magnitude = State(initialValue: 5)
            _iconName = State(initialValue: ScoreCategory.learning.defaultIconName)
            _details = State(initialValue: "")
        case .edit(let rule):
            _name = State(initialValue: rule.name)
            _category = State(initialValue: rule.category)
            _isPenalty = State(initialValue: rule.points < 0)
            _magnitude = State(initialValue: abs(rule.points))
            _iconName = State(initialValue: rule.iconName)
            _details = State(initialValue: rule.details ?? "")
        }
    }

    private var signedPoints: Int { isPenalty ? -magnitude : magnitude }
    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && magnitude > 0
    }
    private var isNew: Bool { if case .new = sheet { return true } else { return false } }

    var body: some View {
        NavigationStack {
            Form {
                Section("名称") {
                    TextField("例如：认真完成作业", text: $name)
                }
                Section {
                    TextField("明确描述规则细节，例如：作业字迹工整、独立完成、按时交…", text: $details, axis: .vertical)
                        .lineLimit(3...6)
                        .onChange(of: details) { _, newValue in
                            if newValue.count > BehaviorRule.detailsMaxLength {
                                details = String(newValue.prefix(BehaviorRule.detailsMaxLength))
                            }
                        }
                } header: {
                    Text("描述（可选）")
                } footer: {
                    HStack {
                        Spacer()
                        Text("\(details.count) / \(BehaviorRule.detailsMaxLength)")
                            .foregroundStyle(details.count >= BehaviorRule.detailsMaxLength ? .orange : .secondary)
                    }
                }
                Section("类别") {
                    Picker("类别", selection: $category) {
                        ForEach(ScoreCategory.allCases, id: \.self) { c in
                            Label(c.localizedName, systemImage: c.defaultIconName).tag(c)
                        }
                    }
                }
                Section("分值") {
                    Picker("类型", selection: $isPenalty) {
                        Text("加分").tag(false)
                        Text("扣分").tag(true)
                    }
                    .pickerStyle(.segmented)
                    HStack {
                        Text("分值")
                        Spacer()
                        TextField("分值", value: $magnitude, format: .number)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 90)
                        Stepper("", value: $magnitude, in: 1...9999).labelsHidden()
                    }
                    Text("当前：\(Theme.pointText(signedPoints)) 分")
                        .font(.caption).foregroundStyle(Theme.pointColor(signedPoints))
                }
                Section("图标") {
                    IconGridPicker(selection: $iconName, options: iconOptions, tint: Theme.color(for: category))
                }
            }
            .navigationTitle(isNew ? "新增规则" : "编辑规则")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存", action: save).disabled(!canSave)
                }
            }
        }
    }

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let trimmedDetails = details.trimmingCharacters(in: .whitespacesAndNewlines)
        let detailsValue: String? = trimmedDetails.isEmpty ? nil : trimmedDetails
        switch sheet {
        case .new:
            repo.addRule(name: trimmedName, details: detailsValue, category: category, points: signedPoints, iconName: iconName)
        case .edit(let rule):
            repo.updateRule(id: rule.id, name: trimmedName, details: detailsValue, category: category, points: signedPoints, iconName: iconName)
        }
        dismiss()
    }
}
