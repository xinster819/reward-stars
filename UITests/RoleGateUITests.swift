import XCTest

/// 端到端验证「角色门禁」：孩子端默认只读、家长功能在通过 PIN 前不可达、
/// 正确 PIN 才能进入家长端、错误/取消不解锁。
final class RoleGateUITests: XCTestCase {

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    /// 启动到孩子端，并强制已知 PIN（UITEST_RESET），保证流程确定性。
    private func launchAsChild() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["UITEST_RESET"] = "1"
        // 固定中文，使下面对中文文案的查询不受模拟器语言影响（本地化后才需要）。
        app.launchArguments += ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN"]
        app.launch()
        return app
    }

    private func enterPIN(_ app: XCUIApplication, _ pin: String) {
        for digit in pin {
            let key = app.buttons["pinKey-\(digit)"]
            XCTAssertTrue(key.waitForExistence(timeout: 5), "PIN 键 \(digit) 未出现")
            key.tap()
        }
    }

    /// 家长端独有的「记分」Tab（孩子端没有），用作"已进入家长端"的判据。
    private func parentTab(_ app: XCUIApplication) -> XCUIElement {
        app.buttons["记分"]
    }

    func testStartsInChildModeWithParentFunctionsHidden() {
        let app = launchAsChild()
        XCTAssertTrue(app.buttons["parentLockButton"].waitForExistence(timeout: 15),
                      "应停留在孩子端并显示家长入口锁")
        XCTAssertFalse(parentTab(app).exists, "孩子端不应出现家长「记分」Tab")
    }

    func testCorrectPINUnlocksParent() {
        let app = launchAsChild()
        let lock = app.buttons["parentLockButton"]
        XCTAssertTrue(lock.waitForExistence(timeout: 15))
        lock.tap()

        XCTAssertTrue(app.staticTexts["家长验证"].waitForExistence(timeout: 5), "应弹出 PIN 门禁")
        enterPIN(app, "1234")

        XCTAssertTrue(parentTab(app).waitForExistence(timeout: 8),
                      "正确 PIN 后应进入家长端（出现「记分」Tab）")
        XCTAssertFalse(app.buttons["parentLockButton"].exists, "家长端不应再显示锁入口")
    }

    func testWrongPINDoesNotUnlock() {
        let app = launchAsChild()
        let lock = app.buttons["parentLockButton"]
        XCTAssertTrue(lock.waitForExistence(timeout: 15))
        lock.tap()

        XCTAssertTrue(app.staticTexts["家长验证"].waitForExistence(timeout: 5))
        enterPIN(app, "0000")

        XCTAssertTrue(app.staticTexts["家长验证"].exists, "错误 PIN 不应关闭门禁")
        XCTAssertFalse(parentTab(app).exists, "错误 PIN 不应解锁家长端")
    }

    func testCancelGateStaysInChildMode() {
        let app = launchAsChild()
        let lock = app.buttons["parentLockButton"]
        XCTAssertTrue(lock.waitForExistence(timeout: 15))
        lock.tap()

        XCTAssertTrue(app.staticTexts["家长验证"].waitForExistence(timeout: 5))
        app.buttons["取消"].tap()

        XCTAssertTrue(app.buttons["parentLockButton"].waitForExistence(timeout: 5),
                      "取消后应回到孩子端")
        XCTAssertFalse(parentTab(app).exists)
    }
}
