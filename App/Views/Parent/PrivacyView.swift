import SwiftUI

/// App 内隐私政策（与根目录 PRIVACY.md 一致的精简版）。
struct PrivacyView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("「行为奖励」是一款纯本地应用，不采集、不上传、不共享任何个人信息。")
                    .font(.headline)

                VStack(alignment: .leading, spacing: 12) {
                    point("不联网、无账号、无服务器、无云同步。")
                    point("孩子名字、头像、规则、积分流水、奖励、兑换，以及你选作头像的照片，只保存在你自己的设备上（含本地备份）。开发者无法访问。")
                    point("无第三方 SDK、无分析、无广告、无任何追踪。")
                    point("家长 PIN 以加盐哈希存于设备钥匙串，明文不写入磁盘。")
                    point("删除 App 即清除全部本地数据。")
                }

                Text("最后更新：2026-06-21")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .padding()
        }
        .navigationTitle("隐私政策")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func point(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "checkmark.seal.fill").foregroundStyle(.green)
            Text(text)
        }
        .font(.callout)
    }
}
