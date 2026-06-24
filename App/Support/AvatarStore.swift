import Foundation
import UIKit

/// 自定义头像文件存储（Documents/Avatars）。avatarSymbol 存标记 "file:Avatars/<name>"，
/// 与 SF Symbol / 资源图名共存（见 AvatarView 解析顺序）。
/// 头像文件随 App 覆盖安装保留（在 Documents 内），版本升级不丢。
enum AvatarStore {

    private static var dir: URL {
        let d = URL.documentsDirectory.appending(path: "Avatars", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }

    /// 保存头像（中心裁剪+缩放到 512²）。返回可写入 avatarSymbol 的标记；失败返回 nil。
    /// 文件名带时间戳确保 avatarSymbol 变化以触发界面刷新；先清理该孩子旧头像。
    static func save(_ image: UIImage, forChild childID: UUID, now: Date = Date()) -> String? {
        guard let data = image.squareResized(512).jpegData(compressionQuality: 0.85) else { return nil }
        pruneAvatars(forChild: childID)
        let name = "\(childID.uuidString)-\(Int(now.timeIntervalSince1970)).jpg"
        let url = dir.appending(path: name)
        guard (try? data.write(to: url, options: .atomic)) != nil else { return nil }
        return "file:Avatars/\(name)"
    }

    /// 若 symbol 是 "file:" 标记且文件存在，返回图片。
    static func customImage(forSymbol symbol: String) -> UIImage? {
        guard symbol.hasPrefix("file:") else { return nil }
        let rel = String(symbol.dropFirst("file:".count))
        let url = URL.documentsDirectory.appending(path: rel)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }

    private static func pruneAvatars(forChild childID: UUID) {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) else { return }
        for file in files where file.lastPathComponent.hasPrefix(childID.uuidString) {
            try? fm.removeItem(at: file)
        }
    }
}

private extension UIImage {
    /// 等比铺满中心裁剪成 side×side（自动校正方向）。
    func squareResized(_ side: CGFloat) -> UIImage {
        let target = CGSize(width: side, height: side)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: target, format: format).image { _ in
            let scale = max(side / size.width, side / size.height)
            let newSize = CGSize(width: size.width * scale, height: size.height * scale)
            let origin = CGPoint(x: (side - newSize.width) / 2, y: (side - newSize.height) / 2)
            draw(in: CGRect(origin: origin, size: newSize))
        }
    }
}
