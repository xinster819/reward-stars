import SwiftUI
import SwiftData
import RewardCore

@main
struct RewardingSystemApp: App {
    let container: ModelContainer
    @State private var roleManager: RoleManager

    init() {
        // 带迁移计划 + 打开前自动备份 + 失败不破坏数据（见 PersistenceController / MIGRATIONS.md）。
        let container = PersistenceController.makeContainer()
        self.container = container

        // 首启 seed 示例数据（用主 context；视图后续从环境 modelContext 构建 repository）。
        let repo = RewardRepository(context: container.mainContext)
        let freshInstall = repo.isEmpty()          // 必须在 seed 之前判定（seed 后库不再为空）
        repo.seedSampleDataIfNeeded()
        // 每次启动写一份 JSON 快照（版本无关、可恢复）。
        DataBackup.writeJSONSnapshot(repo.exportBundle())

        // 首次运行"支持引导的版本"时一次性写入门禁初值：新装→展示引导，升级→跳过。
        let defaults = UserDefaults.standard
        if defaults.object(forKey: "hasSeenOnboarding") == nil {
            defaults.set(OnboardingGate.initialHasSeen(freshInstall: freshInstall), forKey: "hasSeenOnboarding")
        }

        let manager = RoleManager(pinStore: KeychainPINStore())
        // 首次启动设置演示用默认 PIN，保证开箱即可体验家长端（见 SETUP.md，可在设置内修改）。
        if !manager.isPINConfigured {
            try? manager.configurePIN(AppConfig.defaultDemoPIN)
        }
        #if DEBUG
        let env = ProcessInfo.processInfo.environment
        // UI 测试：强制已知 PIN，保证门禁流程确定性（不受历史 Keychain 影响）。
        if env["UITEST_RESET"] == "1" {
            try? manager.configurePIN(AppConfig.defaultDemoPIN)
        }
        // 截图/UI 验证用：通过环境变量直接进入家长端。
        if env["UITEST_ROLE"] == "parent" {
            _ = manager.unlockParent(pin: AppConfig.defaultDemoPIN)
        }
        // 引导 UI 测试：强制展示引导（seed 已建好可改名的孩子）；旧门禁测试则跳过引导。
        if env["UITEST_ONBOARDING"] == "1" {
            defaults.set(false, forKey: "hasSeenOnboarding")
        } else if env["UITEST_RESET"] == "1" {
            defaults.set(true, forKey: "hasSeenOnboarding")
        }
        // 截图/演示用：注入完整示例（含流水），文案随当前语言本地化，使总览/趋势非空。
        if env["UITEST_SEED_FULL"] == "1" {
            repo.resetAndSeedFullSample()
        }
        #endif
        _roleManager = State(initialValue: manager)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(roleManager)
        }
        .modelContainer(container)
    }
}
