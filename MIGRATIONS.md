# 数据迁移手册（MIGRATIONS.md）

> **目标：每次版本迭代都不丢历史数据。** 任何改动 `@Model` 数据结构的提交，都必须照本文走一遍。

## 体系概览（三层保护）

1. **版本化 Schema + 迁移计划**（`App/Persistence/SchemaVersions.swift`）
   - 每个数据结构版本是一个 `VersionedSchema`（`RewardSchemaV1`、`V2`…）。
   - `RewardMigrationPlan` 列出所有版本与版本间的 `MigrationStage`。
   - 容器用该计划打开（`PersistenceController.makeContainer()`），旧库自动迁移。
2. **打开前自动备份库文件**（`DataBackup.backupStoreFiles`）——迁移万一出错可还原。
3. **每次启动导出 JSON 快照**到 `Documents/Backups/`（`DataBackup.writeJSONSnapshot`）——版本无关、人类可读，可经「文件」App 取出，也可在「家长设置 → 恢复最近备份」一键回滚。

另外：**打开失败时绝不删库重建**（`PersistenceController` 里宁可崩溃也不破坏数据）。

---

## 黄金规则

- ❌ **永远不要**为了"让它能跑"而删除/重建 store，或把 `ModelConfiguration` 换成 `isStoredInMemoryOnly` 上线。
- ❌ **永远不要**直接改 `RewardSchemaV1` 已发布版本的模型形状——那是历史快照，要"冻结"。
- ✅ 改结构 = 新增一个 `RewardSchemaVN` + 一个 `MigrationStage` + 一个迁移测试。
- ✅ 能用 **lightweight** 就别用 custom（见下表）。

| 改动 | 迁移类型 |
|---|---|
| 新增**可选**属性 / 新增带默认值的属性 | lightweight |
| 新增一个 `@Model` 类型 | lightweight |
| 删除属性 / 删除模型 | lightweight（数据被丢弃，注意！需要的话先在 custom 里搬运） |
| 重命名属性/模型 | **custom**（或属性加 `@Attribute(originalName:)` 走 lightweight） |
| 改属性类型 / 拆分合并 / 数据转换 | **custom**（`willMigrate`/`didMigrate` 里搬数据） |

---

## 加一个版本（V1 → V2）的标准步骤

以"给 `EventModel` 加一个可选字段 `mood: String?`"为例（lightweight）：

1. **冻结 V1**：把 V1 当前的模型形状复制进 `RewardSchemaV1`（若之前是直接引用顶层类型，现在要在 V1 里保留旧形状的定义副本），确保旧库仍能被读出。
2. **改顶层模型**：给 `EventModel` 加 `var mood: String?`，并入 `RewardSchemaV2`。
3. **登记到迁移计划**：
   ```swift
   enum RewardSchemaV2: VersionedSchema {
       static var versionIdentifier = Schema.Version(2, 0, 0)
       static var models: [any PersistentModel.Type] { [ChildModel.self, RuleModel.self, EventModel.self, RewardModel.self, RedemptionModel.self] }
   }
   enum RewardMigrationPlan: SchemaMigrationPlan {
       static var schemas: [any VersionedSchema.Type] { [RewardSchemaV1.self, RewardSchemaV2.self] }
       static var stages: [MigrationStage] {
           [ .lightweight(fromVersion: RewardSchemaV1.self, toVersion: RewardSchemaV2.self) ]
       }
   }
   ```
4. **更新 `AppSchema.models`** 指向最新版本（`RewardSchemaV2.models`）。
5. **写迁移测试**（见 `AppTests/PersistenceMigrationTests.swift`）：用 V1 schema 在临时 store 写数据 → 用 V2 + 迁移计划打开 → 断言历史数据全在、新字段为默认值。
6. `xcodebuild test` 全绿后再发版。

自定义迁移（重命名/转换）示例骨架：
```swift
.custom(
    fromVersion: RewardSchemaV1.self,
    toVersion: RewardSchemaV2.self,
    willMigrate: { context in /* 读旧数据、转换、暂存 */ try? context.save() },
    didMigrate: { context in /* 回填新字段 */ try? context.save() }
)
```

---

## 发版前自检清单

- [ ] 改了 `@Model`？→ 新增了 `RewardSchemaVN` 且**没有**改动已发布的旧版本快照。
- [ ] `RewardMigrationPlan.schemas` 含全部历史版本，`stages` 覆盖每一段相邻版本。
- [ ] 写了"旧库 → 新版本打开后数据完整"的迁移测试，且通过。
- [ ] 在装有**旧版本+真实数据**的模拟器/设备上**覆盖安装**新版本（不是卸载重装！），确认历史还在。
- [ ] `PersistenceController` 仍是"失败不破坏数据"。

> 真机升级一定要用 **Xcode 覆盖安装**（`Cmd+R`）或 TestFlight，**不要先卸载**——卸载会清空本机数据。开发期想清数据，用「家长设置 → 重置」或「恢复备份」，而不是卸载。

---

## 附：轻量(自动)迁移 vs 显式版本

SwiftData 对**可推断的轻量变化**（新增可选属性、加默认值、加模型）会**自动迁移**并保留数据——不一定需要显式 `MigrationStage`。显式 `VersionedSchema vN + stage` 主要用于**不可自动推断**的变化（改名/类型变更/数据转换=custom）。

无论哪种，发版前都必须：①写一个迁移测试；②在装有旧版+真实数据的模拟器/设备上**覆盖安装**新版，确认历史还在。

**已验证**：v1.1 给 `RuleModel` 加可选 `details`（规则描述）属于自动轻量迁移；已用 iPad(A16) 旧库覆盖升级实测，9 条规则 + 孩子信息原样保留（规则 id 不变）。
