import XCTest
import RewardCore
@testable import RewardingSystem

@MainActor
final class RoleManagerTests: XCTestCase {

    func testStartsLockedInChildRole() {
        let rm = RoleManager(pinStore: InMemoryPINStore())
        XCTAssertEqual(rm.role, .child)
        XCTAssertFalse(rm.isPINConfigured)
    }

    func testConfigurePINThenUnlockParent() throws {
        let rm = RoleManager(pinStore: InMemoryPINStore())
        try rm.configurePIN("1234")
        XCTAssertTrue(rm.isPINConfigured)

        XCTAssertFalse(rm.unlockParent(pin: "0000"))
        XCTAssertEqual(rm.role, .child, "错误 PIN 不应解锁")

        XCTAssertTrue(rm.unlockParent(pin: "1234"))
        XCTAssertEqual(rm.role, .parent)
    }

    func testSwitchToChildLocksAgain() throws {
        let rm = RoleManager(pinStore: InMemoryPINStore())
        try rm.configurePIN("1234")
        _ = rm.unlockParent(pin: "1234")
        rm.switchToChild()
        XCTAssertEqual(rm.role, .child)
    }

    func testChangePINInvalidatesOld() throws {
        let rm = RoleManager(pinStore: InMemoryPINStore())
        try rm.configurePIN("1234")
        try rm.configurePIN("5678")
        XCTAssertFalse(rm.unlockParent(pin: "1234"))
        XCTAssertTrue(rm.unlockParent(pin: "5678"))
    }
}

final class PINStoreTests: XCTestCase {

    func testInMemoryStoreSetVerifyClear() throws {
        let store = InMemoryPINStore()
        XCTAssertFalse(store.isPINSet)
        try store.setPIN("4321")
        XCTAssertTrue(store.isPINSet)
        XCTAssertTrue(store.verify("4321"))
        XCTAssertFalse(store.verify("0000"))
        try store.clear()
        XCTAssertFalse(store.isPINSet)
    }

    func testKeychainStoreRoundTrip() throws {
        // 每次用唯一 account 避免跨测试污染
        let store = KeychainPINStore(service: "com.rewardingsystem.app.pin.test",
                                     account: "parent-\(UUID().uuidString)")
        try? store.clear()
        XCTAssertFalse(store.isPINSet)
        try store.setPIN("2468")
        XCTAssertTrue(store.isPINSet)
        XCTAssertTrue(store.verify("2468"))
        XCTAssertFalse(store.verify("1357"))
        try store.clear()
        XCTAssertFalse(store.isPINSet)
    }
}
