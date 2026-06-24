# First-Launch Onboarding — Design Spec

> Status: approved design (2026-06-23). Feature A2 in [tasks.md](../../../tasks.md).
> Next step after spec approval: writing-plans → implementation.

## Context
Reward Stars / 行为奖励 is a bilingual (zh-Hans/en) iOS reward app being prepped for the App
Store. A fresh install currently boots straight into the read-only **child** view (`ChildTabView`)
with a generic default child name (`宝贝`/"My Child") and a **demo parent PIN `1234`**. There is no
first-launch flow. Two problems for a shipping app: (1) new users get no explanation of the
parent/child model, scoring, or redeeming; (2) shipping with a guessable PIN `1234` means a child can
enter parent mode.

This feature adds a first-launch onboarding that both **teaches** the model and performs **required
first-run setup** (child name + a real parent PIN), closing the security gap. It must NOT disrupt
existing installs (the user's iPad already has data + a real PIN).

## Decisions (locked with user)
- **Scope:** tutorial + set parent PIN + set child name.
- **Skippability:** tutorial info screens are skippable; setting child name AND PIN are **both
  required** before entering the app.
- **Flow structure:** Approach A — a swipeable info carousel followed by one focused setup form.
- **Who:** onboarding is the parent setting up, then handing the device to the child; on completion
  the app rests in child (read-only) mode, which is the default.

## Flow & Screens
A `fullScreenCover` over `RootView`, with two phases inside `OnboardingView`:

**Phase 1 — Intro carousel** (`TabView` with `.tabViewStyle(.page)`, page dots):
1. Welcome — brand + one-line value prop
2. Roles — parent (PIN) vs child (read-only)
3. Scoring — add/remove stars per the rules you set
4. Redeem — saved stars buy rewards you set

A "Skip"/跳过 control (and finishing the last page) advances to Phase 2.

**Phase 2 — Setup form** (non-swiping `Form`, required):
- Child name field, prefilled with the current name (`repo.child()?.name`, default `宝贝`/"My Child");
  must be non-empty after trim.
- Parent PIN: two `SecureField`s (`.keyboardType(.numberPad)`); rule = 4 digits, entered twice, equal
  — identical to `ChangePINView`.
- "开始"/"Start" button, enabled only when name valid AND PIN valid.

On "Start": `repo.renameChild(name)` → `try role.configurePIN(pin)`; only on success set
`hasSeenOnboarding = true` and dismiss. The cover closes and the app shows child mode (default role).

## Components (new, under `App/Views/Onboarding/`)
- `OnboardingView.swift` — container: `@State private var phase` (`.intro` / `.setup`), the paged
  carousel, and the Skip/Continue controls. Hosts `OnboardingSetupView` in the setup phase.
- `OnboardingSetupView.swift` — the name + PIN form and its save action.
- `OnboardingSetup` — a small pure struct/namespace exposing
  `isValid(name:pin:confirm:) -> Bool` so validation is unit-testable without UI. The PIN portion
  reuses the exact predicate from `ChangePINView` (`pin.count == 4 && pin.allSatisfy(\.isNumber) &&
  pin == confirm`); name portion = `!name.trimmingCharacters(in: .whitespaces).isEmpty`.

Reused existing APIs (no new persistence/auth code):
- `RewardRepository.renameChild(_:)` — `App/Persistence/RewardRepository.swift:181`
- `RewardRepository.child()`, `RewardRepository.isEmpty()` — same file (`isEmpty` = no child yet)
- `RoleManager.configurePIN(_:)` / `isPINConfigured` — `App/Auth/RoleManager.swift`

## Gating & existing-user safeguard
- `RootView` gains `@AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = false` and
  presents `OnboardingView` via `.fullScreenCover` while it is `false`.
- **One-time initialization of the flag in `RewardingSystemApp.init()`** so upgraders skip it:
  compute `let freshInstall = repo.isEmpty()` **before** `seedSampleDataIfNeeded()`; then, only if the
  UserDefaults key is unset, set `hasSeenOnboarding = !freshInstall`.
  - Fresh install (empty DB) ⇒ flag `false` ⇒ onboarding shows.
  - Existing install (has child) ⇒ flag `true` ⇒ onboarding skipped (protects the user's iPad).
- Demo PIN `1234` continues to be set transiently in `init()` (so there is never a no-PIN window);
  the **required** PIN step overwrites it, so `1234` never effectively ships on a fresh install.
- Force-quit mid-onboarding: flag is still `false` next launch ⇒ onboarding resumes; the transient
  PIN is unreachable because the cover blocks the gate.
- **DEBUG / UI tests:** force `hasSeenOnboarding = true` under the existing `UITEST_*` launch modes so
  `RoleGateUITests` is unaffected. Add a dedicated `UITEST_ONBOARDING=1` mode that **forces
  `hasSeenOnboarding = false`** (so onboarding appears) without wiping data — seeding still creates the
  child that the setup step renames; this drives the onboarding UI test deterministically.

## Error handling
- PIN/Keychain save failure: inline red error (caption), do NOT dismiss — mirrors `ChangePINView.save()`.
- `renameChild` is non-throwing and guarded by the disabled button; performed before `configurePIN`,
  and the flag/dismiss happen only after `configurePIN` succeeds.

## Localization
- All copy authored as `LocalizedStringKey` string literals (zh-Hans is the source language), then en
  translations added to `App/Localizable.xcstrings` via the `xcrun xcstringstool sync` workflow (CLI
  `xcodebuild` does not auto-write the catalog — see HANDOFF known pitfalls).
- Welcome title carries the brand name per-locale via differing catalog values
  ("行为奖励" / "Reward Stars"). No `InfoPlist.xcstrings` change.

### Draft copy (zh source / en)
| Screen | 中文 | English |
|---|---|---|
| Welcome | 欢迎使用「行为奖励」/ 用星星鼓励好行为 | Welcome to Reward Stars / Encourage good behavior with stars |
| Roles | 两种模式 / 家长用 PIN 进入设规则、记分、管奖励；孩子看到只读的今日进度 | Two modes / Parents enter with a PIN to set rules, score, and manage rewards; kids see a read-only view of today |
| Scoring | 记分 / 按你定的规则给孩子加减星星 | Scoring / Add or remove stars based on the rules you set |
| Redeem | 兑换奖励 / 攒够星星就能兑换你设置的奖励 | Redeem / Saved-up stars can be redeemed for rewards you set |
| Setup | 开始设置 / 给孩子取个名字，设置家长 PIN | Set up / Name your child and set a parent PIN |

## Testing
- **Unit (App XCTest):**
  - `OnboardingSetup.isValid` truth table (valid; short PIN; non-numeric; mismatch; empty name).
  - Gating decision: `freshInstall == true → flag false`; `false → flag true`.
  - Persistence effect: against an in-memory `ModelContainer` + `InMemoryPINStore`, running the Start
    action renames the child and configures the PIN.
- **UI (XCUITest):** launch with `UITEST_ONBOARDING=1` (fresh state, zh-Hans pinned like
  `RoleGateUITests`): assert Welcome appears → Skip → enter name + PIN ×2 → Start → lands on the "今天"
  tab. (Trimmable if it proves flaky.)
- Run `xcodegen generate` after adding files; then `RewardCore` `swift test` (unchanged) + App test
  suite must stay green (currently 39 + 25 + 4).

## Non-goals (YAGNI)
- No "replay onboarding" entry in Settings (would re-trigger required setup awkwardly); name/PIN remain
  editable via existing Settings.
- No biometric (Face ID/Touch ID) prompt during onboarding.
- No multi-child setup (single child remains the shipping scope).
