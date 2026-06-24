import SwiftUI
import SwiftData
import RewardCore

/// 家长奖励商店管理：待审批兑换 + 奖励目录 CRUD / 启停。
struct RewardsAdminView: View {
    @Environment(\.modelContext) private var modelContext
    private var repo: RewardRepository { RewardRepository(context: modelContext) }
    @Query(sort: \RewardModel.sortOrder) private var rewardModels: [RewardModel]
    @Query(sort: \RedemptionModel.requestedAt, order: .reverse) private var redemptionModels: [RedemptionModel]
    @Query private var eventModels: [EventModel]
    @State private var sheet: RewardSheet?

    private var pending: [RedemptionRequest] {
        redemptionModels.map { $0.toDomain() }.filter { $0.status == .pending }
    }
    private var balance: Int {
        ScoringEngine.balance(events: eventModels.map { $0.toDomain() },
                              redemptions: redemptionModels.map { $0.toDomain() })
    }

    var body: some View {
        NavigationStack {
            List {
                if !pending.isEmpty {
                    Section("待审批兑换") {
                        PendingApprovalsList(pending: pending, balance: balance)
                    }
                }
                Section("奖励目录") {
                    if rewardModels.isEmpty {
                        EmptyHint(systemImage: "gift", text: "还没有奖励，点右上角 + 添加")
                            .listRowBackground(Color.clear)
                    }
                    ForEach(rewardModels) { reward in
                        RewardAdminRow(
                            reward: reward.toDomain(),
                            isActive: Binding(
                                get: { reward.isActive },
                                set: { repo.setReward(id: reward.id, active: $0) }
                            ),
                            onEdit: { sheet = .edit(reward) }
                        )
                    }
                    .onDelete(perform: delete)
                }
            }
            .navigationTitle("奖励商店")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { sheet = .new } label: { Image(systemName: "plus") }
                }
            }
            .sheet(item: $sheet) { RewardEditView(sheet: $0) }
        }
    }

    private func delete(at offsets: IndexSet) {
        offsets.map { rewardModels[$0].id }.forEach { repo.deleteReward(id: $0) }
    }
}

private struct RewardAdminRow: View {
    var reward: Reward
    @Binding var isActive: Bool
    var onEdit: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: reward.iconName)
                .foregroundStyle(Theme.accent)
                .frame(width: 30)
            Text(reward.name).font(.body)
            Spacer()
            Text("\(reward.cost) 分")
                .font(.subheadline.bold())
                .foregroundStyle(Theme.accent)
            Toggle("", isOn: $isActive).labelsHidden()
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onEdit)
        .opacity(isActive ? 1 : 0.5)
    }
}

enum RewardSheet: Identifiable {
    case new
    case edit(RewardModel)
    var id: String {
        switch self {
        case .new: return "new"
        case .edit(let reward): return reward.id.uuidString
        }
    }
}

/// 奖励新增 / 编辑表单。
struct RewardEditView: View {
    @Environment(\.modelContext) private var modelContext
    private var repo: RewardRepository { RewardRepository(context: modelContext) }
    @Environment(\.dismiss) private var dismiss
    let sheet: RewardSheet

    @State private var name: String
    @State private var cost: Int
    @State private var iconName: String

    private let iconOptions = [
        "tv.fill", "gamecontroller.fill", "birthday.cake.fill", "books.vertical.fill",
        "tree.fill", "bicycle", "popcorn.fill", "ticket.fill",
        "gift.fill", "fork.knife", "bag.fill", "star.fill"
    ]

    init(sheet: RewardSheet) {
        self.sheet = sheet
        switch sheet {
        case .new:
            _name = State(initialValue: "")
            _cost = State(initialValue: 20)
            _iconName = State(initialValue: "gift.fill")
        case .edit(let reward):
            _name = State(initialValue: reward.name)
            _cost = State(initialValue: reward.cost)
            _iconName = State(initialValue: reward.iconName)
        }
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && cost > 0
    }
    private var isNew: Bool { if case .new = sheet { return true } else { return false } }

    var body: some View {
        NavigationStack {
            Form {
                Section("名称") {
                    TextField("例如：看 30 分钟电视", text: $name)
                }
                Section("所需积分") {
                    Stepper("\(cost) 分", value: $cost, in: 1...1000, step: 5)
                }
                Section("图标") {
                    IconGridPicker(selection: $iconName, options: iconOptions, tint: Theme.accent)
                }
            }
            .navigationTitle(isNew ? "新增奖励" : "编辑奖励")
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
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        switch sheet {
        case .new:
            repo.addReward(name: trimmed, cost: cost, iconName: iconName)
        case .edit(let reward):
            repo.updateReward(id: reward.id, name: trimmed, cost: cost, iconName: iconName)
        }
        dismiss()
    }
}
