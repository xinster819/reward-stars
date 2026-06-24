import SwiftUI

/// 根视图：按角色切换孩子端 / 家长端。家长入口需通过 PIN 门禁。
struct RootView: View {
    @Environment(RoleManager.self) private var role
    #if DEBUG
    @State private var showingGate = ProcessInfo.processInfo.environment["UITEST_GATE"] == "1"
    #else
    @State private var showingGate = false
    #endif
    @State private var unlockAfterDismiss = false
    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = false

    var body: some View {
        Group {
            if role.role == .parent {
                ParentTabView()
            } else {
                ChildTabView(onRequestParent: { showingGate = true })
            }
        }
        // 全新安装首启展示引导（教程可跳过，设孩子名+家长 PIN 必填）；完成后置 hasSeenOnboarding。
        .fullScreenCover(isPresented: Binding(
            get: { !hasSeenOnboarding },
            set: { showing in if !showing { hasSeenOnboarding = true } }
        )) {
            OnboardingView()
        }
        // 鉴权通过后，先关闭门禁弹窗，待其完全 dismiss 再切换角色——
        // 避免"切换宿主视图树 + 关闭 sheet"同帧发生的呈现态竞态（iPad 上更易触发）。
        .sheet(isPresented: $showingGate, onDismiss: {
            if unlockAfterDismiss {
                unlockAfterDismiss = false
                role.enterParent()
            }
        }) {
            ParentGateView(onAuthenticated: {
                unlockAfterDismiss = true
                showingGate = false
            })
        }
    }
}

/// 启动时初始选中的 Tab（仅 DEBUG 下的截图/UI 验证用，发布版恒为 0）。
private func initialTab() -> Int {
    #if DEBUG
    return Int(ProcessInfo.processInfo.environment["UITEST_TAB"] ?? "") ?? 0
    #else
    return 0
    #endif
}

/// 孩子端（只读）。
struct ChildTabView: View {
    var onRequestParent: () -> Void
    @State private var selection = initialTab()
    var body: some View {
        TabView(selection: $selection) {
            ChildDashboardView(onRequestParent: onRequestParent)
                .tabItem { Label("今天", systemImage: "star.fill") }.tag(0)
            ChildStoreView()
                .tabItem { Label("奖励", systemImage: "gift.fill") }.tag(1)
            ChildHistoryView()
                .tabItem { Label("记录", systemImage: "list.bullet.rectangle.portrait.fill") }.tag(2)
        }
    }
}

/// 家长端（完整权限）。
struct ParentTabView: View {
    @State private var selection = initialTab()
    var body: some View {
        TabView(selection: $selection) {
            ParentDashboardView()
                .tabItem { Label("总览", systemImage: "square.grid.2x2.fill") }.tag(0)
            ScoreEntryView()
                .tabItem { Label("记分", systemImage: "plus.circle.fill") }.tag(1)
            RulesAdminView()
                .tabItem { Label("规则", systemImage: "checklist") }.tag(2)
            RewardsAdminView()
                .tabItem { Label("奖励", systemImage: "bag.fill") }.tag(3)
            HistoryView()
                .tabItem { Label("历史", systemImage: "chart.bar.xaxis") }.tag(4)
        }
    }
}
