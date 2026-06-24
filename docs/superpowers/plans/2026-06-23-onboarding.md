# First-Launch Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-launch onboarding (skippable tutorial carousel → required child-name + parent-PIN setup) that only appears on fresh installs.

**Architecture:** A `fullScreenCover` over `RootView`, gated by `@AppStorage("hasSeenOnboarding")`. `OnboardingView` runs a paged intro carousel then hands off to `OnboardingSetupView` (a `Form`). Pure input/gating logic lives in `App/Support/OnboardingSetup.swift` for offline unit testing. Reuses existing `RewardRepository.renameChild(_:)` and `RoleManager.configurePIN(_:)`.

**Tech Stack:** Swift / SwiftUI / SwiftData, iOS 17+, XCTest + XCUITest, xcodegen.

## Global Constraints
- iOS deployment target **17.0**; universal (iPhone + iPad).
- Bilingual: **zh-Hans is the source language**, en added to `App/Localizable.xcstrings`. User-facing strings MUST be `LocalizedStringKey` literals (never `Text(someString)` of type `String`).
- PIN rule (verbatim, matches `ChangePINView`): `pin.count == 4 && pin.allSatisfy(\.isNumber) && pin == confirm`.
- Onboarding: tutorial screens **skippable**; child name **and** PIN **both required** before finishing.
- Existing installs (non-empty DB) MUST skip onboarding; fresh installs (empty DB) MUST show it.
- Demo PIN `1234` stays set transiently in `init` (no no-PIN window); the required PIN step overwrites it.
- Brand name per locale: zh "行为奖励" / en "Reward Stars".
- After adding/removing source files: run `xcodegen generate` before `xcodebuild`.
- Verification gate: `cd RewardCore && swift test` green + `xcodebuild test` green (incl. existing `RoleGateUITests` — regression) + simulator renders.

---

### Task 1: Pure onboarding helpers + unit tests

**Files:**
- Create: `App/Support/OnboardingSetup.swift`
- Test: `AppTests/OnboardingTests.swift`

**Interfaces:**
- Produces: `enum OnboardingSetup { static func isValid(name: String, pin: String, confirm: String) -> Bool }` and `enum OnboardingGate { static func initialHasSeen(freshInstall: Bool) -> Bool }`.

- [ ] **Step 1: Write the failing test**

Create `AppTests/OnboardingTests.swift`:
```swift
import XCTest
@testable import RewardingSystem

final class OnboardingTests: XCTestCase {
    func testIsValid_allGood() {
        XCTAssertTrue(OnboardingSetup.isValid(name: "小明", pin: "1357", confirm: "1357"))
    }
    func testIsValid_emptyOrWhitespaceName() {
        XCTAssertFalse(OnboardingSetup.isValid(name: "   ", pin: "1357", confirm: "1357"))
    }
    func testIsValid_shortPIN() {
        XCTAssertFalse(OnboardingSetup.isValid(name: "小明", pin: "13", confirm: "13"))
    }
    func testIsValid_nonNumericPIN() {
        XCTAssertFalse(OnboardingSetup.isValid(name: "小明", pin: "12a4", confirm: "12a4"))
    }
    func testIsValid_mismatchedConfirm() {
        XCTAssertFalse(OnboardingSetup.isValid(name: "小明", pin: "1357", confirm: "1358"))
    }
    func testGate_freshInstallNeedsOnboarding() {
        XCTAssertFalse(OnboardingGate.initialHasSeen(freshInstall: true))
    }
    func testGate_existingUserSkipsOnboarding() {
        XCTAssertTrue(OnboardingGate.initialHasSeen(freshInstall: false))
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `xcodebuild test -project RewardingSystem.xcodeproj -scheme RewardingSystem -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:RewardingSystemTests/OnboardingTests`
Expected: FAIL — `cannot find 'OnboardingSetup' in scope` (after running `xcodegen generate` so the new test file is in the project).

- [ ] **Step 3: Write minimal implementation**

Create `App/Support/OnboardingSetup.swift`:
```swift
import Foundation

/// 首启引导的纯输入校验（无 UI/持久化依赖，便于离线确定性测试）。
enum OnboardingSetup {
    /// 孩子名去空白后非空；PIN 规则与 ChangePINView 一致：4 位数字、两次一致。
    static func isValid(name: String, pin: String, confirm: String) -> Bool {
        let nameOK = !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let pinOK = pin.count == 4 && pin.allSatisfy(\.isNumber) && pin == confirm
        return nameOK && pinOK
    }
}

/// 首启门禁初值判定。
enum OnboardingGate {
    /// 新安装（空库）需引导 → false；已有数据的升级用户 → 跳过 → true。
    static func initialHasSeen(freshInstall: Bool) -> Bool { !freshInstall }
}
```

- [ ] **Step 4: Run `xcodegen generate`, then the test, to verify it passes**

Run: `xcodegen generate && xcodebuild test -project RewardingSystem.xcodeproj -scheme RewardingSystem -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:RewardingSystemTests/OnboardingTests`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add App/Support/OnboardingSetup.swift AppTests/OnboardingTests.swift project.yml RewardingSystem.xcodeproj
git commit -m "feat(onboarding): pure setup validation + gating helpers with tests"
```

---

### Task 2: First-launch gating in app entry + RootView cover

**Files:**
- Modify: `App/RewardingSystemApp.swift` (the `init()` body, RewardingSystemApp.swift:10-38)
- Modify: `App/Views/RootView.swift` (the `RootView` struct, RootView.swift:4-35)

**Interfaces:**
- Consumes: `OnboardingGate.initialHasSeen(freshInstall:)` (Task 1), `RewardRepository.isEmpty()`, `OnboardingView` (created in Task 3 — this task references it; build will fail until Task 3 lands, so build-verify happens after Task 3).
- Produces: a UserDefaults key `"hasSeenOnboarding"` and a `fullScreenCover` presenting `OnboardingView`.

- [ ] **Step 1: Compute fresh-install before seeding and initialize the flag**

In `App/RewardingSystemApp.swift`, replace the seed block (currently lines 15-19) so `freshInstall` is captured BEFORE `seedSampleDataIfNeeded()`, and add the one-time flag init + UI-test hooks. New `init()` body section:
```swift
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
```

- [ ] **Step 2: Add UI-test hooks for onboarding inside the existing `#if DEBUG` block**

In the same `init()`, inside the existing `#if DEBUG ... #endif` (currently lines 26-36), add after the `env` is read:
```swift
        // 引导 UI 测试：强制展示引导（seed 已建好可改名的孩子）。
        if env["UITEST_ONBOARDING"] == "1" {
            defaults.set(false, forKey: "hasSeenOnboarding")
        } else if env["UITEST_RESET"] == "1" {
            // 旧门禁 UI 测试（RoleGateUITests）不应被引导阻挡。
            defaults.set(true, forKey: "hasSeenOnboarding")
        }
```
(Place this where `let env = ProcessInfo.processInfo.environment` is already defined; reuse that `env`.)

- [ ] **Step 3: Gate RootView with a fullScreenCover**

In `App/Views/RootView.swift`, add the stored flag and present the cover. Add to `RootView`'s properties:
```swift
    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = false
```
Then attach to the existing `Group { ... }` in `body` (alongside the existing `.sheet`):
```swift
        .fullScreenCover(isPresented: Binding(
            get: { !hasSeenOnboarding },
            set: { showing in if !showing { hasSeenOnboarding = true } }
        )) {
            OnboardingView()
        }
```

- [ ] **Step 4: Defer build verification to Task 3** (RootView now references `OnboardingView`, defined next). No standalone run here.

- [ ] **Step 5: Commit (with Task 3)** — this task is committed together with Task 3 since the build only compiles once `OnboardingView` exists.

---

### Task 3: OnboardingView (carousel) + OnboardingSetupView (form)

**Files:**
- Create: `App/Views/Onboarding/OnboardingView.swift`
- Create: `App/Views/Onboarding/OnboardingSetupView.swift`

**Interfaces:**
- Consumes: `OnboardingSetup.isValid` (Task 1); `RewardRepository.renameChild(_:)` / `.child()`; `RoleManager.configurePIN(_:)` (env `RoleManager.self`); `@AppStorage("hasSeenOnboarding")`.
- Produces: `struct OnboardingView: View` (referenced by RootView, Task 2).

- [ ] **Step 1: Create `OnboardingView.swift`**
```swift
import SwiftUI

/// 首启引导：可跳过的介绍轮播 → 必填设置（孩子名 + 家长 PIN）。
struct OnboardingView: View {
    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = false
    @State private var phase: Phase = .intro
    @State private var page = 0

    private enum Phase { case intro, setup }

    private struct Slide: Identifiable {
        let id: Int
        let symbol: String
        let title: LocalizedStringKey
        let body: LocalizedStringKey
    }
    private let slides: [Slide] = [
        .init(id: 0, symbol: "star.circle.fill", title: "欢迎使用「行为奖励」", body: "用星星鼓励好行为"),
        .init(id: 1, symbol: "person.2.fill", title: "两种模式",
              body: "家长用 PIN 进入设规则、记分、管奖励；孩子看到只读的今日进度"),
        .init(id: 2, symbol: "plus.forwardslash.minus", title: "记分", body: "按你定的规则给孩子加减星星"),
        .init(id: 3, symbol: "gift.fill", title: "兑换奖励", body: "攒够星星就能兑换你设置的奖励"),
    ]

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
                ForEach(slides) { slide in
                    VStack(spacing: 20) {
                        Image(systemName: slide.symbol)
                            .font(.system(size: 72)).foregroundStyle(.tint)
                        Text(slide.title).font(.title.bold()).multilineTextAlignment(.center)
                        Text(slide.body).font(.body).foregroundStyle(.secondary)
                            .multilineTextAlignment(.center).padding(.horizontal, 32)
                    }
                    .tag(slide.id)
                }
            }
            .tabViewStyle(.page)
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            Button(action: advance) {
                Text(page < slides.count - 1 ? "继续" : "开始设置")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent).controlSize(.large).padding()
        }
    }

    private func advance() {
        if page < slides.count - 1 { withAnimation { page += 1 } } else { phase = .setup }
    }
}
```

- [ ] **Step 2: Create `OnboardingSetupView.swift`**
```swift
import SwiftUI
import SwiftData

/// 首启必填设置：孩子名 + 家长 PIN（复用 RewardRepository.renameChild / RoleManager.configurePIN）。
struct OnboardingSetupView: View {
    var onDone: () -> Void
    @Environment(\.modelContext) private var modelContext
    @Environment(RoleManager.self) private var role

    @State private var name = ""
    @State private var pin = ""
    @State private var confirm = ""
    @State private var error: String?

    private var isValid: Bool { OnboardingSetup.isValid(name: name, pin: pin, confirm: confirm) }

    var body: some View {
        NavigationStack {
            Form {
                Section("孩子的名字") {
                    TextField("给孩子取个名字", text: $name)
                }
                Section("家长 PIN（4 位数字）") {
                    SecureField("输入 PIN", text: $pin).keyboardType(.numberPad)
                    SecureField("再次输入", text: $confirm).keyboardType(.numberPad)
                }
                if let error {
                    Text(error).foregroundStyle(.red).font(.caption)
                }
            }
            .navigationTitle("开始设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("开始", action: start).disabled(!isValid)
                }
            }
            .onAppear {
                if name.isEmpty {
                    name = RewardRepository(context: modelContext).child()?.name ?? ""
                }
            }
        }
    }

    private func start() {
        guard isValid else { return }
        RewardRepository(context: modelContext).renameChild(name)
        do {
            try role.configurePIN(pin)
            onDone()
        } catch {
            self.error = "保存失败，请重试"
        }
    }
}
```

- [ ] **Step 3: Regenerate project and build**

Run: `xcodegen generate && xcodebuild build -project RewardingSystem.xcodeproj -scheme RewardingSystem -destination 'platform=iOS Simulator,name=iPhone 17 Pro'`
Expected: BUILD SUCCEEDED.

- [ ] **Step 4: Run the full App test suite (regression — RoleGateUITests must still pass)**

Run: `xcodebuild test -project RewardingSystem.xcodeproj -scheme RewardingSystem -destination 'platform=iOS Simulator,name=iPhone 17 Pro'`
Expected: PASS, including `OnboardingTests` and the existing `RoleGateUITests` (the latter proves onboarding doesn't block the old gate flow, via the `UITEST_RESET` hook).

- [ ] **Step 5: Commit (Tasks 2 + 3 together)**

```bash
git add App/RewardingSystemApp.swift App/Views/RootView.swift App/Views/Onboarding/ project.yml RewardingSystem.xcodeproj
git commit -m "feat(onboarding): gate fresh installs + carousel and required setup form"
```

---

### Task 4: English localization for new strings

**Files:**
- Modify: `App/Localizable.xcstrings`

**Interfaces:** none (resource only). The String Catalog keys are the zh-Hans literals from Tasks 1–3.

- [ ] **Step 1: Extract new keys into the catalog**

CLI `xcodebuild` does not auto-write the catalog. After Task 3's build, locate the build's `.stringsdata` and sync (exclude `Index.noindex`):
```bash
DD=$(xcodebuild -project RewardingSystem.xcodeproj -scheme RewardingSystem -showBuildSettings 2>/dev/null | awk -F' = ' '/ BUILD_DIR /{print $2}')
SD=$(find "$DD/.." -path '*Index.noindex*' -prune -o -name '*.stringsdata' -print 2>/dev/null | tr '\n' ' ')
xcrun xcstringstool sync App/Localizable.xcstrings --stringsdata $SD
```
(If the sync path proves fragile, hand-add the entries below — the catalog is JSON keyed by the zh literal.)

- [ ] **Step 2: Fill the `en` values for the new keys**

Add/confirm these `en` translations (zh key → en value). Keys that already exist from `ChangePINView` ("家长 PIN（4 位数字）", "再次输入", "保存失败，请重试") already have en — leave them.
| zh key | en value |
|---|---|
| 欢迎使用「行为奖励」 | Welcome to Reward Stars |
| 用星星鼓励好行为 | Encourage good behavior with stars |
| 两种模式 | Two modes |
| 家长用 PIN 进入设规则、记分、管奖励；孩子看到只读的今日进度 | Parents enter with a PIN to set rules, score, and manage rewards; kids see a read-only view of today |
| 记分 | Scoring |
| 按你定的规则给孩子加减星星 | Add or remove stars based on the rules you set |
| 兑换奖励 | Redeem rewards |
| 攒够星星就能兑换你设置的奖励 | Saved-up stars can be redeemed for rewards you set |
| 跳过 | Skip |
| 继续 | Continue |
| 开始设置 | Set up |
| 孩子的名字 | Child's name |
| 给孩子取个名字 | Name your child |
| 输入 PIN | Enter PIN |
| 开始 | Start |

(If "记分" / "兑换奖励" already exist as keys with different en, reuse the existing entry rather than duplicating.)

- [ ] **Step 3: Verify both locales render**

Run (en): `xcodebuild build ... ` then launch simulator with `-AppleLanguages "(en)" -AppleLocale "en_US"`; confirm onboarding welcome shows "Welcome to Reward Stars". Run (zh) with `-AppleLanguages "(zh-Hans)"`; confirm "欢迎使用「行为奖励」".

- [ ] **Step 4: Commit**
```bash
git add App/Localizable.xcstrings
git commit -m "i18n(onboarding): add English translations for onboarding strings"
```

---

### Task 5: End-to-end onboarding UI test + final regression

**Files:**
- Create: `UITests/OnboardingUITests.swift`

**Interfaces:** Consumes the `UITEST_ONBOARDING=1` launch hook (Task 2).

- [ ] **Step 1: Write the UI test**

Create `UITests/OnboardingUITests.swift`:
```swift
import XCTest

final class OnboardingUITests: XCTestCase {
    func testFreshInstall_completesSetup_landsInChild() {
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN"]
        app.launchEnvironment["UITEST_ONBOARDING"] = "1"
        app.launch()

        XCTAssertTrue(app.staticTexts["欢迎使用「行为奖励」"].waitForExistence(timeout: 8),
                      "首启应展示引导欢迎页")
        app.buttons["跳过"].tap()

        let nameField = app.textFields.firstMatch
        XCTAssertTrue(nameField.waitForExistence(timeout: 5))
        nameField.tap(); nameField.typeText("测试娃")

        let secure = app.secureTextFields
        secure.element(boundBy: 0).tap(); secure.element(boundBy: 0).typeText("2468")
        secure.element(boundBy: 1).tap(); secure.element(boundBy: 1).typeText("2468")

        app.buttons["开始"].tap()
        XCTAssertTrue(app.tabBars.buttons["今天"].waitForExistence(timeout: 8),
                      "完成设置后应落到孩子端「今天」")
    }
}
```

- [ ] **Step 2: Regenerate + run only the new UI test**

Run: `xcodegen generate && xcodebuild test -project RewardingSystem.xcodeproj -scheme RewardingSystem -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:RewardingSystemUITests/OnboardingUITests`
Expected: PASS. (If the welcome-text query is flaky due to「」, fall back to asserting the "跳过" button exists instead.)

- [ ] **Step 3: Full regression — all tests + simulator smoke**

Run: `cd RewardCore && swift test` (expect green) then `cd .. && xcodebuild test -project RewardingSystem.xcodeproj -scheme RewardingSystem -destination 'platform=iOS Simulator,name=iPhone 17 Pro'`
Expected: ALL green (RewardCore + RewardingSystemTests incl. OnboardingTests + RewardingSystemUITests incl. RoleGateUITests and OnboardingUITests). Launch the app once in the simulator to confirm onboarding renders and dismisses.

- [ ] **Step 4: Commit**
```bash
git add UITests/OnboardingUITests.swift project.yml RewardingSystem.xcodeproj
git commit -m "test(onboarding): end-to-end fresh-install setup UI test"
```

---

## Self-Review

**Spec coverage:** ✅ tutorial carousel (Task 3) · ✅ skippable tutorial / required setup (Task 1 validation + Task 3 disabled button + "跳过" only skips tutorial) · ✅ child name + PIN (Task 3) · ✅ fresh-install gate + existing-user safeguard (Tasks 1–2) · ✅ transient 1234 overwrite (unchanged init + required PIN) · ✅ error handling (Task 3 `start()` catch) · ✅ localization (Task 4) · ✅ unit + UI tests (Tasks 1, 5) · ✅ UITEST hooks not disrupting RoleGateUITests (Task 2 + Task 5 regression).

**Placeholder scan:** No TBD/TODO; all steps carry real code or exact commands. The `.stringsdata` path in Task 4 is resolved at runtime via the documented `find`/`xcstringstool` procedure (environment-specific DerivedData hash cannot be hardcoded).

**Type consistency:** `OnboardingSetup.isValid(name:pin:confirm:)` and `OnboardingGate.initialHasSeen(freshInstall:)` used identically across Tasks 1–3. `hasSeenOnboarding` key string identical in App.init, RootView, OnboardingView. `OnboardingView()` / `OnboardingSetupView(onDone:)` signatures match call sites.

## Execution
Loop mode (DECISIONS D20): executing **inline** via superpowers:executing-plans — no execution-mode prompt. Controller re-verifies each task's tests itself (§5 lesson 5).
