import XCTest
@testable import RewardCore

final class SmokeTests: XCTestCase {
    func testVersionExposed() {
        XCTAssertEqual(RewardCore.version, "0.1.0")
    }
}
