import Foundation
import CryptoKit

/// PIN 的加盐哈希（SHA-256）。纯函数，便于测试。
/// 真实存储由 App 层 Keychain 完成；这里只负责确定性哈希。
public enum PINHasher {
    public static func hash(pin: String, salt: Data) -> Data {
        var data = salt
        data.append(contentsOf: Array(pin.utf8))
        return Data(SHA256.hash(data: data))
    }
}
