import SwiftUI
import RewardCore

/// 首启引导：可跳过的"演示型"介绍轮播（用真实组件 + 示例数据展示，而非干说）→ 必填设置。
struct OnboardingView: View {
    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = false
    @State private var phase: Phase = .intro
    @State private var page = OnboardingView.initialPage()
    private enum Phase { case intro, setup }
    private static let pageCount = 4

    #if DEBUG
    /// 截图/UI 验证用：从指定页起步（发布版恒为 0）。
    private static func initialPage() -> Int {
        Int(ProcessInfo.processInfo.environment["UITEST_ONBOARDING_PAGE"] ?? "") ?? 0
    }
    #else
    private static func initialPage() -> Int { 0 }
    #endif

    var body: some View {
        switch phase {
        case .intro: introView
        case .setup: OnboardingSetupView(onDone: { hasSeenOnboarding = true })
        }
    }

    private var introView: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button("跳过") { phase = .setup }.padding()
            }
            TabView(selection: $page) {
                OnboardingSlide(title: "欢迎使用「行为奖励」", caption: "用星星鼓励好行为") {
                    WelcomePreview()
                }.tag(0)
                OnboardingSlide(title: "两种模式",
                                caption: "家长用 PIN 进入设规则、记分、管奖励；孩子看到只读的今日进度") {
                    RolesPreview()
                }.tag(1)
                OnboardingSlide(title: "记分", caption: "按你定的规则给孩子加减星星") {
                    ScoringPreview(active: page == 2)
                }.tag(2)
                OnboardingSlide(title: "兑换奖励", caption: "攒够星星就能兑换你设置的奖励") {
                    RedeemPreview(active: page == 3)
                }.tag(3)
            }
            .tabViewStyle(.page)
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            Button(action: advance) {
                Text(page < Self.pageCount - 1 ? "继续" : "开始设置")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent).controlSize(.large).padding()
        }
    }

    private func advance() {
        if page < Self.pageCount - 1 { withAnimation { page += 1 } } else { phase = .setup }
    }
}

/// 单页框架：居中、限宽（iPad 不空旷），上方为「演示预览」，下方标题 + 说明。
private struct OnboardingSlide<Preview: View>: View {
    var title: LocalizedStringKey
    var caption: LocalizedStringKey
    @ViewBuilder var preview: Preview

    var body: some View {
        VStack(spacing: 28) {
            Spacer(minLength: 0)
            preview
            VStack(spacing: 10) {
                Text(title).font(.title.bold()).multilineTextAlignment(.center)
                Text(caption).font(.body).foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: 460)
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 28)
    }
}

// MARK: - 演示预览（复用真实组件 + 示例数据）

/// 欢迎：品牌星 + 环绕小星，登场时轻微弹入。
private struct WelcomePreview: View {
    @State private var shown = false
    private struct Star: Identifiable { let id: Int; let size: CGFloat; let x: CGFloat; let y: CGFloat; let delay: Double }
    private let stars: [Star] = [
        .init(id: 0, size: 18, x: -96, y: -64, delay: 0.05),
        .init(id: 1, size: 13, x: 88, y: -48, delay: 0.12),
        .init(id: 2, size: 22, x: -70, y: 70, delay: 0.18),
        .init(id: 3, size: 15, x: 100, y: 58, delay: 0.24),
        .init(id: 4, size: 11, x: 118, y: -8, delay: 0.30),
    ]

    var body: some View {
        ZStack {
            ForEach(stars) { s in
                Image(systemName: "star.fill")
                    .font(.system(size: s.size))
                    .foregroundStyle(Theme.accent.opacity(0.55))
                    .offset(x: s.x, y: s.y)
                    .scaleEffect(shown ? 1 : 0.1)
                    .opacity(shown ? 1 : 0)
                    .animation(.spring(response: 0.5, dampingFraction: 0.6).delay(s.delay), value: shown)
            }
            Image(systemName: "star.fill")
                .font(.system(size: 60))
                .foregroundStyle(.white)
                .frame(width: 128, height: 128)
                .background(Theme.accent.gradient, in: Circle())
                .scaleEffect(shown ? 1 : 0.6)
                .animation(.spring(response: 0.5, dampingFraction: 0.7), value: shown)
        }
        .frame(height: 230)
        .onAppear { shown = true }
    }
}

/// 两种模式：家长入口 / 孩子 两张小卡。
private struct RolesPreview: View {
    var body: some View {
        HStack(spacing: 16) {
            card(icon: "lock.fill", label: "家长入口", tint: Theme.accent)
            card(icon: "figure.child", label: "孩子", tint: .blue)
        }
        .frame(maxWidth: 420)
    }

    private func card(icon: String, label: LocalizedStringKey, tint: Color) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon).font(.system(size: 30)).foregroundStyle(.white)
                .frame(width: 64, height: 64).background(tint.gradient, in: Circle())
            Text(label).font(.headline)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 26)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18))
    }
}

/// 记分：真实进度环 + 总分（登场时 64→74，环填充），并弹入一条 +10 记分。
private struct ScoringPreview: View {
    var active: Bool
    private var total: Int { active ? 74 : 64 }
    private var fraction: Double { active ? 0.74 : 0.64 }

    var body: some View {
        VStack(spacing: 22) {
            ZStack {
                ProgressRing(progress: fraction, lineWidth: 14).frame(width: 148, height: 148)
                VStack(spacing: 2) {
                    Text("\(total)").font(.system(size: 42, weight: .bold)).contentTransition(.numericText())
                    Text("总分").font(.caption).foregroundStyle(.secondary)
                }
            }
            HStack(spacing: 12) {
                Image(systemName: "checkmark.seal.fill").foregroundStyle(Theme.color(for: .learning))
                Text("认真完成作业").font(.body)
                Spacer(minLength: 8)
                PointPill(points: 10)
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
            .frame(maxWidth: 320)
            .opacity(active ? 1 : 0)
            .offset(y: active ? 0 : 14)
        }
        .animation(.easeOut(duration: 0.6), value: active)
    }
}

/// 兑换：真实奖励卡。登场时余额 14→20，进度条填满并变为可「兑换」。
private struct RedeemPreview: View {
    var active: Bool
    private let reward = Reward(name: "看 30 分钟电视", cost: 20, iconName: "tv.fill")

    var body: some View {
        RewardStoreCard(reward: reward, balance: active ? 20 : 14, pending: false, onRedeem: {})
            .frame(maxWidth: 260)
            .allowsHitTesting(false)
            .animation(.easeOut(duration: 0.6), value: active)
    }
}
