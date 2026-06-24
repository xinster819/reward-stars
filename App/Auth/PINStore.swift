import Foundation
import Security
import RewardCore

/// 家长 PIN 存储抽象。App 用 Keychain 实现；测试/预览用内存实现。
protocol PINStoring {
    var isPINSet: Bool { get }
    func setPIN(_ pin: String) throws
    func verify(_ pin: String) -> Bool
    func clear() throws
}

/// 16 字节随机盐。
func makeRandomSalt(_ count: Int = 16) -> Data {
    var bytes = [UInt8](repeating: 0, count: count)
    if SecRandomCopyBytes(kSecRandomDefault, count, &bytes) != errSecSuccess {
        for i in 0..<count { bytes[i] = UInt8.random(in: 0...255) }
    }
    return Data(bytes)
}

/// 内存实现（测试 / 预览）。存 salt + hash，不落盘。
final class InMemoryPINStore: PINStoring {
    private var salt: Data?
    private var hash: Data?

    var isPINSet: Bool { hash != nil }

    func setPIN(_ pin: String) throws {
        let salt = makeRandomSalt()
        self.salt = salt
        self.hash = PINHasher.hash(pin: pin, salt: salt)
    }

    func verify(_ pin: String) -> Bool {
        guard let salt, let hash else { return false }
        return PINHasher.hash(pin: pin, salt: salt) == hash
    }

    func clear() throws {
        salt = nil
        hash = nil
    }
}

enum KeychainError: Error { case unexpectedStatus(OSStatus) }

/// Keychain 实现：存储 48 字节 blob = salt(16) + sha256(salt+pin)(32)。
/// 明文 PIN 永不落盘；验证时重算哈希比对。
final class KeychainPINStore: PINStoring {
    private let service: String
    private let account: String

    init(service: String = "com.rewardingsystem.app.pin", account: String = "parent") {
        self.service = service
        self.account = account
    }

    var isPINSet: Bool { read() != nil }

    func setPIN(_ pin: String) throws {
        let salt = makeRandomSalt()
        var blob = salt
        blob.append(PINHasher.hash(pin: pin, salt: salt))
        try write(blob)
    }

    func verify(_ pin: String) -> Bool {
        guard let blob = read(), blob.count == 48 else { return false }
        let salt = Data(blob.prefix(16))
        let storedHash = Data(blob.suffix(32))
        return PINHasher.hash(pin: pin, salt: salt) == storedHash
    }

    func clear() throws {
        let status = SecItemDelete(baseQuery() as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unexpectedStatus(status)
        }
    }

    // MARK: SecItem helpers

    private func baseQuery() -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }

    private func read() -> Data? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess else { return nil }
        return item as? Data
    }

    private func write(_ data: Data) throws {
        try clear()
        var attributes = baseQuery()
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeychainError.unexpectedStatus(status) }
    }
}
