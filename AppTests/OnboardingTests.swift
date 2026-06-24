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

    func testSanitizedPIN_truncatesToFour() {
        XCTAssertEqual(OnboardingSetup.sanitizedPIN("123456"), "1234")
    }
    func testSanitizedPIN_stripsNonDigits() {
        XCTAssertEqual(OnboardingSetup.sanitizedPIN("1a2b3"), "123")
    }
    func testSanitizedPIN_passesShortNumeric() {
        XCTAssertEqual(OnboardingSetup.sanitizedPIN("12"), "12")
    }
    func testSanitizedPIN_empty() {
        XCTAssertEqual(OnboardingSetup.sanitizedPIN(""), "")
    }
}
