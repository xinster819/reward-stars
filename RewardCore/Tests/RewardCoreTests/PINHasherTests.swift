import XCTest
@testable import RewardCore

final class PINHasherTests: XCTestCase {

    func testSameInputProducesSameHash() {
        let salt = Data([1, 2, 3, 4])
        XCTAssertEqual(PINHasher.hash(pin: "1234", salt: salt),
                       PINHasher.hash(pin: "1234", salt: salt))
    }

    func testDifferentPinProducesDifferentHash() {
        let salt = Data([1, 2, 3, 4])
        XCTAssertNotEqual(PINHasher.hash(pin: "1234", salt: salt),
                          PINHasher.hash(pin: "0000", salt: salt))
    }

    func testDifferentSaltProducesDifferentHash() {
        XCTAssertNotEqual(PINHasher.hash(pin: "1234", salt: Data([1])),
                          PINHasher.hash(pin: "1234", salt: Data([2])))
    }

    func testHashIsSha256Length() {
        XCTAssertEqual(PINHasher.hash(pin: "1234", salt: Data()).count, 32)
    }
}
