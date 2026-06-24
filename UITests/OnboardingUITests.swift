import XCTest

final class OnboardingUITests: XCTestCase {

    /// 全新安装：展示引导 → 跳过教程 → 填孩子名 + PIN → 落到孩子端「今天」。
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

    /// PIN 输入应被限制为 4 位：键入 6 位仍应截断到 4 位、两次一致 → 可完成设置。
    /// （SecureField 文本无法直接读取，故以"能完成 → 落到今天"间接证明限制生效。）
    func testSetup_pinCappedToFourDigits_stillCompletes() {
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN"]
        app.launchEnvironment["UITEST_ONBOARDING"] = "1"
        app.launch()

        XCTAssertTrue(app.buttons["跳过"].waitForExistence(timeout: 8))
        app.buttons["跳过"].tap()

        let nameField = app.textFields.firstMatch
        XCTAssertTrue(nameField.waitForExistence(timeout: 5))
        nameField.tap(); nameField.typeText("测试娃")

        let secure = app.secureTextFields
        secure.element(boundBy: 0).tap(); secure.element(boundBy: 0).typeText("246810")
        secure.element(boundBy: 1).tap(); secure.element(boundBy: 1).typeText("246810")

        app.buttons["开始"].tap()
        XCTAssertTrue(app.tabBars.buttons["今天"].waitForExistence(timeout: 8),
                      "6 位输入应截断为 4 位「2468」并一致 → 完成设置；若未截断则 PIN 无效、无法完成")
    }

    /// 英文本地化：en 环境下引导欢迎页显示英文品牌文案。
    func testFreshInstall_englishWelcomeLocalized() {
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launchEnvironment["UITEST_ONBOARDING"] = "1"
        app.launch()

        XCTAssertTrue(app.staticTexts["Welcome to Reward Stars"].waitForExistence(timeout: 8),
                      "en 环境引导欢迎页应显示英文文案（验证 Localizable.xcstrings）")
    }
}
