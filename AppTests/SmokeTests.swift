import XCTest
@testable import RewardingSystem
import RewardCore

final class SmokeTests: XCTestCase {
    func testCoreLinked() {
        XCTAssertEqual(RewardCore.version, "0.1.0")
    }
}
