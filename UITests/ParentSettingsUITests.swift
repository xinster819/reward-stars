import XCTest

final class ParentSettingsUITests: XCTestCase {

    /// 家长设置「关于」区应有「联系我们」入口并显示联系邮箱。
    func testSettings_showsContactUsWithEmail() {
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN"]
        app.launchEnvironment["UITEST_RESET"] = "1"   // 已知 PIN + 跳过引导
        app.launchEnvironment["UITEST_ROLE"] = "parent" // 直接进入家长端
        app.launch()

        let gear = app.buttons["settingsButton"]
        XCTAssertTrue(gear.waitForExistence(timeout: 8), "家长总览应有设置入口")
        gear.tap()

        // 「关于」在表单底部，滚动到可见。
        app.swipeUp()
        app.swipeUp()

        let contact = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", "联系我们")).firstMatch
        XCTAssertTrue(contact.waitForExistence(timeout: 5), "设置应有「联系我们」入口")

        let email = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", "xinster819ca")).firstMatch
        XCTAssertTrue(email.exists, "应显示联系邮箱")
    }
}
