import XCTest
import UIKit
@testable import RewardingSystem

final class AvatarStoreTests: XCTestCase {

    func testSaveThenLoadCustomAvatar() throws {
        let image = UIImage(systemName: "star.fill")!
        let childID = UUID()

        let marker = try XCTUnwrap(AvatarStore.save(image, forChild: childID))
        XCTAssertTrue(marker.hasPrefix("file:Avatars/"), "应返回 file: 标记")
        XCTAssertNotNil(AvatarStore.customImage(forSymbol: marker), "应能加载回保存的头像")

        // 非 file: 标记（SF Symbol / 资源名）应返回 nil，交给 AvatarView 后续解析
        XCTAssertNil(AvatarStore.customImage(forSymbol: "person.crop.circle.fill"))
        XCTAssertNil(AvatarStore.customImage(forSymbol: "ChildAvatar"))

        // 清理
        let rel = String(marker.dropFirst("file:".count))
        try? FileManager.default.removeItem(at: URL.documentsDirectory.appending(path: rel))
    }
}
