import SwiftUI
import UIKit
import PhotosUI

/// 孩子头像。解析顺序：上传照片("file:"标记) → 资源目录图片名 → SF Symbol；
/// 都不命中时回退默认头像。两种方式向后兼容。
struct AvatarView: View {
    var symbol: String
    var size: CGFloat

    var body: some View {
        if let uploaded = AvatarStore.customImage(forSymbol: symbol) {
            // 用户上传的照片
            Image(uiImage: uploaded)
                .resizable()
                .scaledToFill()
                .frame(width: size, height: size)
                .clipShape(Circle())
        } else if UIImage(named: symbol) != nil {
            // 资源目录图片
            Image(symbol)
                .resizable()
                .scaledToFill()
                .frame(width: size, height: size)
                .clipShape(Circle())
        } else {
            // SF Symbol；无效名（如文件丢失的 file: 标记）回退默认头像
            let sf = UIImage(systemName: symbol) != nil ? symbol : "person.crop.circle.fill"
            Image(systemName: sf)
                .font(.system(size: size * 0.55))
                .foregroundStyle(Theme.accent)
                .frame(width: size, height: size)
                .background(Theme.accent.opacity(0.15), in: Circle())
        }
    }
}

/// 头像选择器：点头像→从相册选图→裁剪保存→回调新标记（由调用方持久化）。
/// 孩子端与家长端共用（两者都可改头像）。
struct AvatarPicker: View {
    var childID: UUID
    var symbol: String
    var size: CGFloat
    var onPicked: (String) -> Void

    @State private var item: PhotosPickerItem?

    var body: some View {
        PhotosPicker(selection: $item, matching: .images, photoLibrary: .shared()) {
            AvatarView(symbol: symbol, size: size)
                .overlay(alignment: .bottomTrailing) {
                    Image(systemName: "camera.circle.fill")
                        .font(.system(size: size * 0.34))
                        .symbolRenderingMode(.palette)
                        .foregroundStyle(.white, Theme.accent)
                        .background(Circle().fill(.white).padding(2))
                }
        }
        .buttonStyle(.plain)
        .onChange(of: item) { _, newItem in
            guard let newItem else { return }
            Task {
                guard let data = try? await newItem.loadTransferable(type: Data.self),
                      let image = UIImage(data: data),
                      let marker = AvatarStore.save(image, forChild: childID) else { return }
                await MainActor.run {
                    onPicked(marker)
                    item = nil
                }
            }
        }
    }
}
