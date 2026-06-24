import XCTest
import SwiftData
import RewardCore
@testable import RewardingSystem

@MainActor
final class PersistenceMigrationTests: XCTestCase {

    private let now = Date(timeIntervalSince1970: 1_704_067_200)

    private func makeInMemoryRepo() throws -> RewardRepository {
        let container = try ModelContainer(for: Schema(AppSchema.models),
                                           configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        return RewardRepository(context: ModelContext(container))
    }

    /// 核心承诺：写入的数据在容器关闭后、用同一迁移计划重新打开时完整保留
    /// （模拟 App 升级/重启时历史记录不受影响）。
    func testHistorySurvivesContainerReopenWithMigrationPlan() throws {
        let url = FileManager.default.temporaryDirectory.appending(path: "mig-\(UUID().uuidString).store")
        defer {
            for s in ["", "-wal", "-shm"] {
                try? FileManager.default.removeItem(at: URL(fileURLWithPath: url.path + s))
            }
        }
        let schema = Schema(AppSchema.models)

        // 第一次打开：seed + 记一次分（产生历史）
        do {
            let container = try ModelContainer(for: schema, migrationPlan: RewardMigrationPlan.self,
                                               configurations: ModelConfiguration(schema: schema, url: url))
            let repo = RewardRepository(context: ModelContext(container))
            repo.seedSampleDataIfNeeded(now: now)
            let rule = repo.addRule(name: "作业", category: .learning, points: 10, iconName: nil)
            repo.recordScore(ruleID: rule.id, note: "历史记录", at: now)
            XCTAssertEqual(repo.events().count, 1)
        }

        // 重新打开同一个库（迁移计划相同）：数据应原样保留
        let container2 = try ModelContainer(for: schema, migrationPlan: RewardMigrationPlan.self,
                                            configurations: ModelConfiguration(schema: schema, url: url))
        let repo2 = RewardRepository(context: ModelContext(container2))
        XCTAssertNotNil(repo2.child(), "孩子信息应保留")
        XCTAssertEqual(repo2.events().count, 1, "历史流水应保留")
        XCTAssertEqual(repo2.events().first?.note, "历史记录")
        XCTAssertGreaterThan(repo2.rules().count, 0, "规则应保留")
    }

    func testMigrationPlanContainsCurrentSchema() {
        XCTAssertTrue(RewardMigrationPlan.schemas.contains { $0 == RewardSchemaV1.self })
        XCTAssertEqual(RewardSchemaV1.versionIdentifier, Schema.Version(1, 0, 0))
    }

    func testBackupBundleCodableRoundTripExact() throws {
        let bundle = BackupBundle(
            schemaVersion: "1.0.0",
            exportedAt: Date(timeIntervalSince1970: 1234.5),
            children: [ChildProfile(name: "小明", avatarSymbol: "ChildAvatar")],
            rules: [BehaviorRule(name: "作业", category: .learning, points: 10)],
            events: [ScoreEvent(ruleID: UUID(), ruleName: "作业", category: .learning,
                                points: 10, note: "好", timestamp: now)],
            rewards: [Reward(name: "看电视", cost: 20)],
            redemptions: [RedemptionRequest(rewardID: UUID(), rewardName: "看电视", cost: 20)])
        let decoded = try DataBackup.decode(DataBackup.encode(bundle))
        XCTAssertEqual(decoded, bundle, "备份编解码必须完全无损（含时间戳精度）")
    }

    /// 旧版本导出的备份（规则无 details 字段）必须能被新版本解码（details=nil），保证恢复不丢。
    func testOldBackupWithoutDetailsStillDecodes() throws {
        let json = """
        {"schemaVersion":"1.0.0","exportedAt":0,"children":[],"events":[],"redemptions":[],"rewards":[],
         "rules":[{"id":"\(UUID().uuidString)","name":"作业","category":"learning","points":10,
           "iconName":"book.fill","isActive":true,"sortOrder":0,"createdAt":0,"childID":"\(UUID().uuidString)"}]}
        """.data(using: .utf8)!
        let bundle = try DataBackup.decode(json)
        XCTAssertEqual(bundle.rules.count, 1)
        XCTAssertEqual(bundle.rules.first?.name, "作业")
        XCTAssertNil(bundle.rules.first?.details, "旧备份缺 details 应解码为 nil（向后兼容）")
    }

    func testSetAvatarPersists() throws {
        let repo = try makeInMemoryRepo()
        repo.seedSampleDataIfNeeded(now: now)
        repo.setAvatar("file:Avatars/test.jpg")
        XCTAssertEqual(repo.child()?.avatarSymbol, "file:Avatars/test.jpg")
    }

    func testRuleDetailsPersistAndUpdate() throws {
        let repo = try makeInMemoryRepo()
        let rule = repo.addRule(name: "作业", details: "字迹工整、独立完成、按时交", category: .learning, points: 10, iconName: nil)
        XCTAssertEqual(repo.rules().first?.details, "字迹工整、独立完成、按时交")
        repo.updateRule(id: rule.id, name: "作业", details: nil, category: .learning, points: 12, iconName: nil)
        XCTAssertNil(repo.rules().first?.details)
        XCTAssertEqual(repo.rules().first?.points, 12)
    }

    func testExportThenImportRestoresAllData() throws {
        let src = try makeInMemoryRepo()
        src.seedSampleDataIfNeeded(now: now)
        let rule = src.ruleModels().first!
        src.recordScore(ruleID: rule.id, note: "历史", at: now)
        let bundle = src.exportBundle(now: now)

        let dst = try makeInMemoryRepo()
        dst.importBundle(bundle, replace: true)
        XCTAssertNotNil(dst.child())
        XCTAssertEqual(dst.events().count, 1)
        XCTAssertEqual(dst.rules().count, src.rules().count)
        XCTAssertEqual(dst.rewards().count, src.rewards().count)
        XCTAssertEqual(dst.balance(), src.balance())
    }
}
