import WidgetKit
import SwiftUI

// MARK: - Entry

struct QuoteEntry: TimelineEntry {
    let date: Date
    let quoteText: String
    let quoteAuthor: String
    let quoteWork: String?
    let recommended: String
    let avoided: String
    let moodRawValue: String?

    static let placeholder = QuoteEntry(
        date: .now,
        quoteText: "窗镜子里浮现着冰冷而硕大的雪花，在敞",
        quoteAuthor: "萧红",
        quoteWork: "生死场",
        recommended: "在自然光下读几页纸质书",
        avoided: "把休息当成需要被证明才能拥有的的东西",
        moodRawValue: nil
    )

    static let previewLong = QuoteEntry(
        date: .now,
        quoteText: "窗镜子里浮现着冰冷而硕大的雪花，在敞开领口、揩拭脖颈的驹子周围，飘扬着一条条银线。雪光把房间里的轮廓衬得更浅，仿佛有人把呼吸也停在了玻璃的另一面。",
        quoteAuthor: "加西亚·马尔克斯",
        quoteWork: nil,
        recommended: "出门走一段不常走的路，看陌生的窗口",
        avoided: "用沉默代替真正想说的话",
        moodRawValue: "contemplative"
    )

    var authorLine: String {
        if let quoteWork, !quoteWork.isEmpty {
            return "—— \(quoteAuthor)《\(quoteWork)》"
        }
        return "—— \(quoteAuthor)"
    }
}

// MARK: - Timeline Provider

struct QuoteProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> QuoteEntry {
        .placeholder
    }

    func snapshot(for configuration: ConfigurationAppIntent, in context: Context) async -> QuoteEntry {
        .placeholder
    }

    func timeline(for configuration: ConfigurationAppIntent, in context: Context) async -> Timeline<QuoteEntry> {
        let entry = QuoteEntry.placeholder
        let nextUpdate = Calendar.current.startOfDay(for: Date()).addingTimeInterval(86400 + 18000)
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }
}

// MARK: - Small Widget (2×2)

struct SmallQuoteView: View {
    let entry: QuoteEntry

    private let authorThreshold = 25
    private let workTitleThreshold = 4

    var body: some View {
        let showsAuthor = entry.quoteText.count <= authorThreshold

        VStack(spacing: showsAuthor ? 8 : 0) {
            Text(entry.quoteText)
                .font(.system(size: 15, weight: .regular, design: .serif))
                .foregroundStyle(Color("textPrimary"))
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .frame(maxHeight: .infinity, alignment: .center)

            if showsAuthor {
                Text(authorLine)
                    .font(.system(size: 12))
                    .foregroundStyle(Color("textTertiary"))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .padding(16)
    }

    private var authorLine: String {
        if let work = entry.quoteWork, work.count <= workTitleThreshold {
            return "—— \(entry.quoteAuthor)《\(work)》"
        }
        return "—— \(entry.quoteAuthor)"
    }
}

// MARK: - Medium Widget (4×2)

struct MediumQuoteView: View {
    let entry: QuoteEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(entry.quoteText)
                .font(.system(size: 15, design: .serif))
                .foregroundStyle(Color("textPrimary"))
                .lineSpacing(3)

            Text(entry.authorLine)
                .font(.system(size: 13))
                .foregroundStyle(Color("textTertiary"))
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.top, 8)

            Divider()
                .padding(.vertical, 16)

            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text("宜：")
                        .font(.system(size: 14))
                        .foregroundStyle(Color("yi"))
                    Text(entry.recommended)
                        .font(.system(size: 14))
                        .foregroundStyle(Color("textSecondary"))
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }

                HStack(spacing: 8) {
                    Text("忌：")
                        .font(.system(size: 14))
                        .foregroundStyle(Color("ji"))
                    Text(entry.avoided)
                        .font(.system(size: 14))
                        .foregroundStyle(Color("textSecondary"))
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }
            }
        }
        .padding(16)
    }
}

// MARK: - Large Widget (4×4)

struct LargeQuoteView: View {
    let entry: QuoteEntry

    private let moods: [(rawValue: String, label: String)] = [
        ("calm", "静"), ("sad", "失落"), ("anxious", "不安"), ("happy", "轻盈"),
        ("hopeful", "希望"), ("tender", "温柔"), ("contemplative", "沉淀"), ("angry", "压着")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(entry.quoteText)
                .font(.system(size: 17, design: .serif))
                .foregroundStyle(Color("textPrimary"))
                .lineSpacing(4)

            Text(entry.authorLine)
                .font(.system(size: 13))
                .foregroundStyle(Color("textTertiary"))
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.top, 8)

            Divider()
                .padding(.vertical, 16)

            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text("宜：")
                        .font(.system(size: 14))
                        .foregroundStyle(Color("yi"))
                    Text(entry.recommended)
                        .font(.system(size: 14))
                        .foregroundStyle(Color("textSecondary"))
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }

                HStack(spacing: 8) {
                    Text("忌：")
                        .font(.system(size: 14))
                        .foregroundStyle(Color("ji"))
                    Text(entry.avoided)
                        .font(.system(size: 14))
                        .foregroundStyle(Color("textSecondary"))
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }
            }

            HStack(spacing: 6) {
                ForEach(moods, id: \.rawValue) { mood in
                    let isSelected = mood.rawValue == entry.moodRawValue
                    HStack(spacing: 4) {
                        Circle()
                            .fill(Color(mood.rawValue))
                            .frame(width: 5, height: 5)

                        Text(mood.label)
                            .font(.system(size: 10.5))
                            .foregroundStyle(isSelected ? Color("textPrimary") : Color("textSecondary"))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 28)
                    .background(
                        RoundedRectangle(cornerRadius: 999)
                            .fill(isSelected ? Color(mood.rawValue).opacity(0.14) : .clear)
                    )
                }
            }
            .padding(.top, 16)
        }
        .padding(16)
    }
}

// MARK: - Widget Configuration

struct quotes: Widget {
    let kind: String = "cain.com.daily-oracle.quotes"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: ConfigurationAppIntent.self, provider: QuoteProvider()) { entry in
            WidgetEntryView(entry: entry)
                .containerBackground(Color("backgroundPrimary"), for: .widget)
        }
        .configurationDisplayName("每日名句")
        .description("每日一句名句与今日宜忌")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct WidgetEntryView: View {
    let entry: QuoteEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallQuoteView(entry: entry)
        case .systemMedium:
            MediumQuoteView(entry: entry)
        default:
            LargeQuoteView(entry: entry)
        }
    }
}

#Preview("All Sizes") {
    ScrollView {
        VStack(spacing: 16) {
            SmallQuoteView(entry: .placeholder)
                .frame(width: 169, height: 169)
            MediumQuoteView(entry: .previewLong)
                .frame(height: 169)
            LargeQuoteView(entry: .previewLong)
                .frame(height: 376)
        }
        .padding()
    }
    .background(Color("backgroundPrimary"))
}

#Preview(as: .systemSmall) {
    quotes()
} timeline: {
    QuoteEntry.placeholder
    QuoteEntry.previewLong
}

#Preview(as: .systemMedium) {
    quotes()
} timeline: {
    QuoteEntry.previewLong
}

#Preview(as: .systemLarge) {
    quotes()
} timeline: {
    QuoteEntry.previewLong
}
