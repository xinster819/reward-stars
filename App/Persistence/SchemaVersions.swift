import Foundation
import SwiftData

// 版本化 Schema + 迁移计划。
// 数据结构每次演进都新增一个 VersionedSchema，并在 RewardMigrationPlan 里追加一个
// MigrationStage（加字段=lightweight；改名/转换/拆分=custom）。详见根目录 MIGRATIONS.md。
//
// 当前持久化模型类型仍是顶层 @Model（ChildModel 等）。新增 V2 时：
//   1) 把 V1 当前模型形状"冻结"进 RewardSchemaV1（复制定义，确保旧库可被读出）；
//   2) 顶层模型改成新形状，并归入 RewardSchemaV2.models；
//   3) RewardMigrationPlan.schemas 追加 V2、stages 追加 V1→V2 的迁移。

enum RewardSchemaV1: VersionedSchema {
    static var versionIdentifier = Schema.Version(1, 0, 0)
    static var models: [any PersistentModel.Type] {
        [ChildModel.self, RuleModel.self, EventModel.self, RewardModel.self, RedemptionModel.self]
    }
}

/// 迁移计划：列出全部历史 Schema 版本与版本间迁移阶段。当前仅 V1（无迁移阶段）。
enum RewardMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] {
        [RewardSchemaV1.self]
    }
    static var stages: [MigrationStage] {
        []   // 新增版本时在此追加：.lightweight(...) 或 .custom(...)
    }
}
