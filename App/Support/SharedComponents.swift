import SwiftUI
import RewardCore

/// 进度环（0...1）。
struct ProgressRing: View {
    var progress: Double
    var lineWidth: CGFloat = 12
    var tint: Color = Theme.accent

    var body: some View {
        ZStack {
            Circle().stroke(tint.opacity(0.18), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0, min(1, progress)))
                .stroke(tint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeOut, value: progress)
        }
    }
}

/// 带符号分值药丸。
struct PointPill: View {
    var points: Int
    var body: some View {
        Text(Theme.pointText(points))
            .font(.subheadline.weight(.bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Theme.pointColor(points), in: Capsule())
    }
}

/// 类别标签。
struct CategoryChip: View {
    var category: ScoreCategory
    var body: some View {
        Label(category.localizedName, systemImage: category.defaultIconName)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Theme.color(for: category).opacity(0.15), in: Capsule())
            .foregroundStyle(Theme.color(for: category))
    }
}

/// 徽章图标 + 名称。
struct BadgeChip: View {
    var badge: Badge
    var earned: Bool = true
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: badge.iconName)
                .font(.title2)
                .foregroundStyle(.white)
                .frame(width: 54, height: 54)
                .background((earned ? Theme.accent : Color.gray).gradient, in: Circle())
                .opacity(earned ? 1 : 0.4)
            Text(badge.localizedTitle)
                .font(.caption2)
                .lineLimit(1)
                .foregroundStyle(earned ? .primary : .secondary)
        }
        .frame(width: 72)
    }
}

/// 卡片容器。
struct SectionCard<Content: View>: View {
    var title: LocalizedStringKey?
    var systemImage: String?
    @ViewBuilder var content: Content

    init(_ title: LocalizedStringKey? = nil, systemImage: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.systemImage = systemImage
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let title {
                Label {
                    Text(title).font(.headline)
                } icon: {
                    if let systemImage { Image(systemName: systemImage) }
                }
                .foregroundStyle(.primary)
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18))
    }
}

/// 统计小格子。
struct StatTile: View {
    var title: LocalizedStringKey
    var value: String
    var systemImage: String
    var tint: Color
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: systemImage).font(.title3).foregroundStyle(tint)
            Text(value).font(.title2.bold()).contentTransition(.numericText())
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
    }
}

/// 一条行为流水行。
struct EventRow: View {
    var event: ScoreEvent
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: event.category.defaultIconName)
                .foregroundStyle(Theme.color(for: event.category))
                .frame(width: 30)
            VStack(alignment: .leading, spacing: 2) {
                Text(event.ruleName).font(.body)
                HStack(spacing: 6) {
                    Text(event.timestamp, format: .dateTime.month().day().hour().minute())
                    if let note = event.note, !note.isEmpty {
                        Text("· \(note)").lineLimit(1)
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            PointPill(points: event.points)
        }
        .padding(.vertical, 2)
    }
}

/// 图标选择网格（规则/奖励编辑共用）。
struct IconGridPicker: View {
    @Binding var selection: String
    var options: [String]
    var tint: Color

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 48))], spacing: 12) {
            ForEach(options, id: \.self) { symbol in
                Image(systemName: symbol)
                    .font(.title2)
                    .frame(width: 44, height: 44)
                    .background(selection == symbol ? tint.opacity(0.25) : Color(.secondarySystemBackground),
                                in: RoundedRectangle(cornerRadius: 10))
                    .foregroundStyle(selection == symbol ? tint : .primary)
                    .onTapGesture { selection = symbol }
            }
        }
    }
}

/// 空状态占位。
struct EmptyHint: View {
    var systemImage: String
    var text: LocalizedStringKey
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: systemImage).font(.largeTitle).foregroundStyle(.secondary)
            Text(text).font(.callout).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }
}
