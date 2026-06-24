import Foundation
import SwiftData
import RewardCore

/// 持久化 + 业务编排。封装 ModelContext，对外暴露领域投影与变更操作；
/// 所有计算委托给 RewardCore 纯引擎，自身只管取数 / 落库。
@MainActor
final class RewardRepository {
    let context: ModelContext
    let childID: UUID

    init(context: ModelContext, childID: UUID = ChildProfile.sampleChildID) {
        self.context = context
        self.childID = childID
    }

    // MARK: - 原始取数（按 childID 过滤）

    func ruleModels() -> [RuleModel] {
        fetchAll(RuleModel.self).filter { $0.childID == childID }
            .sorted { $0.sortOrder < $1.sortOrder }
    }
    func eventModels() -> [EventModel] {
        fetchAll(EventModel.self).filter { $0.childID == childID }
    }
    func rewardModels() -> [RewardModel] {
        fetchAll(RewardModel.self).filter { $0.childID == childID }
            .sorted { $0.sortOrder < $1.sortOrder }
    }
    func redemptionModels() -> [RedemptionModel] {
        fetchAll(RedemptionModel.self).filter { $0.childID == childID }
    }
    func childModel() -> ChildModel? {
        fetchAll(ChildModel.self).first { $0.id == childID }
    }

    private func fetchAll<T: PersistentModel>(_ type: T.Type) -> [T] {
        (try? context.fetch(FetchDescriptor<T>())) ?? []
    }

    // MARK: - 领域投影

    func child() -> ChildProfile? { childModel()?.toDomain() }
    func rules() -> [BehaviorRule] { ruleModels().map { $0.toDomain() } }
    func activeRules() -> [BehaviorRule] { rules().filter(\.isActive) }
    func events() -> [ScoreEvent] { eventModels().map { $0.toDomain() } }
    func rewards() -> [Reward] { rewardModels().map { $0.toDomain() } }
    func redemptions() -> [RedemptionRequest] { redemptionModels().map { $0.toDomain() } }

    // MARK: - 计算（委托 RewardCore 引擎）
    // 说明：视图层用 @Query + 引擎/ScoreSummary 直接派生展示值（@Query 才能驱动 SwiftUI 刷新）；
    // 这里只保留 mutation 路径与测试所需的少量派生（balance / recentEvents / pendingRedemptions）。

    func balance() -> Int { ScoringEngine.balance(events: events(), redemptions: redemptions()) }
    func recentEvents(limit: Int) -> [ScoreEvent] { ScoringEngine.recentEvents(events: events(), limit: limit) }
    func pendingRedemptions() -> [RedemptionRequest] { redemptions().filter { $0.status == .pending } }

    // MARK: - 规则 CRUD

    @discardableResult
    func addRule(name: String, details: String? = nil, category: ScoreCategory, points: Int, iconName: String?) -> RuleModel {
        let nextOrder = (ruleModels().map(\.sortOrder).max() ?? -1) + 1
        let domain = BehaviorRule(name: name, details: details, category: category, points: points,
                                  iconName: iconName, sortOrder: nextOrder, childID: childID)
        let model = RuleModel(domain)
        context.insert(model)
        save()
        return model
    }

    func updateRule(id: UUID, name: String, details: String? = nil, category: ScoreCategory, points: Int, iconName: String?) {
        guard let model = ruleModels().first(where: { $0.id == id }) else { return }
        model.name = name
        model.details = details
        model.category = category
        model.points = points
        model.iconName = iconName ?? category.defaultIconName
        save()
    }

    func setRule(id: UUID, active: Bool) {
        guard let model = ruleModels().first(where: { $0.id == id }) else { return }
        model.isActive = active
        save()
    }

    func deleteRule(id: UUID) {
        guard let model = ruleModels().first(where: { $0.id == id }) else { return }
        context.delete(model)
        save()
    }

    // MARK: - 奖励 CRUD

    @discardableResult
    func addReward(name: String, cost: Int, iconName: String?) -> RewardModel {
        let nextOrder = (rewardModels().map(\.sortOrder).max() ?? -1) + 1
        let domain = Reward(name: name, cost: cost,
                            iconName: iconName ?? "gift.fill", sortOrder: nextOrder, childID: childID)
        let model = RewardModel(domain)
        context.insert(model)
        save()
        return model
    }

    func updateReward(id: UUID, name: String, cost: Int, iconName: String?) {
        guard let model = rewardModels().first(where: { $0.id == id }) else { return }
        model.name = name
        model.cost = cost
        model.iconName = iconName ?? "gift.fill"
        save()
    }

    func setReward(id: UUID, active: Bool) {
        guard let model = rewardModels().first(where: { $0.id == id }) else { return }
        model.isActive = active
        save()
    }

    func deleteReward(id: UUID) {
        guard let model = rewardModels().first(where: { $0.id == id }) else { return }
        context.delete(model)
        save()
    }

    // MARK: - 记分 / 撤销

    @discardableResult
    func recordScore(ruleID: UUID, note: String?, at date: Date = Date()) -> Bool {
        guard let rule = ruleModels().first(where: { $0.id == ruleID }) else { return false }
        let event = ScoreEvent(ruleID: rule.id, ruleName: rule.name, category: rule.category,
                               points: rule.points, note: note, timestamp: date, childID: childID)
        context.insert(EventModel(event))
        save()
        return true
    }

    /// 撤销最近一次未作废事件（软删除）。返回被撤销的事件，无可撤销则 nil。
    @discardableResult
    func undoLastEvent() -> ScoreEvent? {
        guard let last = ScoringEngine.lastUndoableEvent(events: events()),
              let model = eventModels().first(where: { $0.id == last.id }) else { return nil }
        model.isVoided = true
        save()
        return last
    }

    // MARK: - 兑换

    @discardableResult
    func requestRedemption(rewardID: UUID, at date: Date = Date()) -> Bool {
        guard let reward = rewardModels().first(where: { $0.id == rewardID }) else { return false }
        let request = RedemptionRequest(rewardID: reward.id, rewardName: reward.name, cost: reward.cost,
                                        status: .pending, requestedAt: date, childID: childID)
        context.insert(RedemptionModel(request))
        save()
        return true
    }

    /// 家长通过兑换：余额不足则失败（保持待确认）。
    @discardableResult
    func approveRedemption(id: UUID, at date: Date = Date()) -> Bool {
        guard let model = redemptionModels().first(where: { $0.id == id }), model.status == .pending else { return false }
        guard balance() >= model.cost else { return false }
        model.status = .approved
        model.decidedAt = date
        save()
        return true
    }

    func rejectRedemption(id: UUID, at date: Date = Date()) {
        guard let model = redemptionModels().first(where: { $0.id == id }), model.status == .pending else { return }
        model.status = .rejected
        model.decidedAt = date
        save()
    }

    // MARK: - 孩子 / 积分维护

    /// 修改孩子名字。
    func renameChild(_ name: String) {
        guard let model = childModel() else { return }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        model.name = trimmed
        save()
    }

    /// 修改孩子头像标记（SF Symbol 名 / 资源名 / "file:" 上传标记）。
    func setAvatar(_ symbol: String) {
        guard let model = childModel() else { return }
        model.avatarSymbol = symbol
        save()
    }

    /// 积分清零：清空全部记分流水与兑换记录，保留规则与奖励目录。
    func clearScores() {
        eventModels().forEach { context.delete($0) }
        redemptionModels().forEach { context.delete($0) }
        save()
    }

    // MARK: - 备份 / 恢复

    /// 导出当前孩子的全量数据为版本无关的快照。
    func exportBundle(now: Date = Date()) -> BackupBundle {
        BackupBundle(
            schemaVersion: "\(RewardSchemaV1.versionIdentifier)",
            exportedAt: now,
            children: [childModel()?.toDomain()].compactMap { $0 },
            rules: rules(),
            events: events(),
            rewards: rewards(),
            redemptions: redemptions())
    }

    /// 从快照恢复。replace=true 时先清空当前数据再导入。
    func importBundle(_ bundle: BackupBundle, replace: Bool) {
        if replace {
            ruleModels().forEach { context.delete($0) }
            eventModels().forEach { context.delete($0) }
            rewardModels().forEach { context.delete($0) }
            redemptionModels().forEach { context.delete($0) }
            if let c = childModel() { context.delete(c) }
            save()
        }
        bundle.children.forEach { context.insert(ChildModel($0)) }
        bundle.rules.forEach { context.insert(RuleModel($0)) }
        bundle.events.forEach { context.insert(EventModel($0)) }
        bundle.rewards.forEach { context.insert(RewardModel($0)) }
        bundle.redemptions.forEach { context.insert(RedemptionModel($0)) }
        save()
    }

    // MARK: - Seeding

    func isEmpty() -> Bool { childModel() == nil }

    /// 干净起步：插入孩子 + 示例规则 + 示例奖励，但**不插入任何流水**（初始总分 0）。
    func seedSampleDataIfNeeded(now: Date = Date(), childName: String = "") {
        guard isEmpty() else { return }
        let bundle = SampleData.make(now: now, childID: childID)
        // 示例文案按当前语言本地化（中文键 → 译文）；默认用内置插画头像，用户可自行上传。
        let name = childName.isEmpty ? loc("宝贝") : childName
        context.insert(ChildModel(ChildProfile(id: childID, name: name,
                                               avatarSymbol: "DefaultAvatar", createdAt: now)))
        bundle.rules.forEach { rule in
            var localized = rule
            localized.name = loc(rule.name)
            context.insert(RuleModel(localized))
        }
        bundle.rewards.forEach { reward in
            var localized = reward
            localized.name = loc(reward.name)
            context.insert(RewardModel(localized))
        }
        save()
    }

    /// 重置为初始状态：清空全部数据并重新干净 seed（规则/奖励恢复默认、积分归零）。
    func resetAndSeed(now: Date = Date(), childName: String = "") {
        ruleModels().forEach { context.delete($0) }
        eventModels().forEach { context.delete($0) }
        rewardModels().forEach { context.delete($0) }
        redemptionModels().forEach { context.delete($0) }
        if let c = childModel() { context.delete(c) }
        save()
        seedSampleDataIfNeeded(now: now, childName: childName)
    }

    #if DEBUG
    /// 截图/演示用：清空并 seed **完整**示例（含流水→总分/趋势/连击/最近记录非空），
    /// 文案按当前语言本地化（中文键→译文）。仅 DEBUG，经 UITEST_SEED_FULL 调用，不参与 Release。
    func resetAndSeedFullSample(now: Date = Date()) {
        ruleModels().forEach { context.delete($0) }
        eventModels().forEach { context.delete($0) }
        rewardModels().forEach { context.delete($0) }
        redemptionModels().forEach { context.delete($0) }
        if let c = childModel() { context.delete(c) }
        save()

        let bundle = SampleData.make(now: now, childID: childID)
        context.insert(ChildModel(ChildProfile(id: childID, name: loc("宝贝"),
                                               avatarSymbol: "DefaultAvatar", createdAt: now)))
        bundle.rules.forEach { rule in
            var r = rule; r.name = loc(rule.name); context.insert(RuleModel(r))
        }
        bundle.rewards.forEach { reward in
            var rw = reward; rw.name = loc(reward.name); context.insert(RewardModel(rw))
        }
        bundle.events.forEach { event in
            var e = event
            e.ruleName = loc(event.ruleName)
            e.note = nil   // 演示流水不带自由文本备注，避免未翻译串泄漏到英文截图
            context.insert(EventModel(e))
        }
        save()
    }
    #endif

    private func save() {
        do { try context.save() }
        catch { assertionFailure("SwiftData save 失败: \(error)") }
    }
}
