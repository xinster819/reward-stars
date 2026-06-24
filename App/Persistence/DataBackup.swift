import Foundation
import RewardCore

/// 全量数据快照（版本无关、人类可读、可恢复）。所有字段均为 RewardCore 的 Codable 域类型，
/// 不依赖 SwiftData 内部结构，因此跨版本始终可读。
struct BackupBundle: Codable, Equatable {
    var schemaVersion: String
    var exportedAt: Date
    var children: [ChildProfile]
    var rules: [BehaviorRule]
    var events: [ScoreEvent]
    var rewards: [Reward]
    var redemptions: [RedemptionRequest]
}

/// 数据备份/恢复。两层保护：
/// 1) 打开库前复制 SQLite 库文件（迁移出错可还原）；
/// 2) 每次启动写一份 JSON 快照到 Documents（用户可经"文件"App 取出/留存）。
enum DataBackup {

    // MARK: - 库文件备份（打开/迁移前的安全网）

    static func backupStoreFiles(storeURL: URL, now: Date = Date(), keepBackups: Int = 5) {
        let fm = FileManager.default
        guard fm.fileExists(atPath: storeURL.path) else { return }   // 首启无库，跳过
        let dir = storeBackupsDir()
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        let stamp = Self.stamp(now)
        for suffix in ["", "-wal", "-shm"] {
            let src = URL(fileURLWithPath: storeURL.path + suffix)
            guard fm.fileExists(atPath: src.path) else { continue }
            let dst = dir.appending(path: "\(storeURL.lastPathComponent)\(suffix).\(stamp).bak")
            try? fm.copyItem(at: src, to: dst)
        }
        prune(dir: dir, keepLast: keepBackups * 3)   // 每次最多 3 个文件
    }

    // MARK: - JSON 快照（Documents/Backups，用户可见）

    @discardableResult
    static func writeJSONSnapshot(_ bundle: BackupBundle, keepLast: Int = 10) -> URL? {
        let dir = jsonBackupsDir()
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appending(path: "reward-backup-\(Self.stamp(bundle.exportedAt)).json")
        guard let data = try? encode(bundle) else { return nil }
        guard (try? data.write(to: url, options: .atomic)) != nil else { return nil }
        prune(dir: dir, keepLast: keepLast)
        return url
    }

    static func latestJSONSnapshot() -> BackupBundle? {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(
            at: jsonBackupsDir(), includingPropertiesForKeys: [.contentModificationDateKey]) else { return nil }
        let newest = files.filter { $0.pathExtension == "json" }
            .sorted { ($0.modDate ?? .distantPast) > ($1.modDate ?? .distantPast) }
            .first
        guard let newest, let data = try? Data(contentsOf: newest) else { return nil }
        return try? decode(data)
    }

    static func encode(_ bundle: BackupBundle) throws -> Data {
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        // 用默认日期策略（数值，全精度）保证恢复时时间戳与原值完全一致，不丢精度。
        return try enc.encode(bundle)
    }

    static func decode(_ data: Data) throws -> BackupBundle {
        try JSONDecoder().decode(BackupBundle.self, from: data)
    }

    // MARK: - 路径 / 工具

    static func jsonBackupsDir() -> URL {
        URL.documentsDirectory.appending(path: "Backups", directoryHint: .isDirectory)
    }
    private static func storeBackupsDir() -> URL {
        URL.applicationSupportDirectory.appending(path: "RewardingSystem/StoreBackups", directoryHint: .isDirectory)
    }
    private static func stamp(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyyMMdd-HHmmss"
        return f.string(from: date)
    }
    private static func prune(dir: URL, keepLast: Int) {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(
            at: dir, includingPropertiesForKeys: [.contentModificationDateKey]) else { return }
        let sorted = files.sorted { ($0.modDate ?? .distantPast) > ($1.modDate ?? .distantPast) }
        for old in sorted.dropFirst(keepLast) { try? fm.removeItem(at: old) }
    }
}

private extension URL {
    var modDate: Date? {
        (try? resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
    }
}
