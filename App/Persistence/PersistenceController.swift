import Foundation
import SwiftData

/// 创建持久化容器：带迁移计划、打开前自动备份、失败绝不破坏数据。
enum PersistenceController {

    static func makeContainer() -> ModelContainer {
        let schema = Schema(AppSchema.models)
        let config = ModelConfiguration(schema: schema)   // 默认存储位置

        // 打开（可能触发迁移）之前先备份现有库文件——迁移万一出错也能还原。
        DataBackup.backupStoreFiles(storeURL: config.url)

        do {
            return try ModelContainer(
                for: schema,
                migrationPlan: RewardMigrationPlan.self,
                configurations: config)
        } catch {
            // 关键：绝不删除/重建库。宁可崩溃也不静默丢数据；原库与备份均保留，可人工恢复。
            fatalError("打开数据库失败（已保留原库与备份，未做任何破坏性操作）：\(error)")
        }
    }
}
