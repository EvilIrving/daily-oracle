import SwiftUI

struct WidgetPreviewLarge: View {
    private let record: WidgetPreviewLargeRecord

    init(record: WidgetPreviewLargeRecord = .preview) {
        self.record = record
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(record.quoteText)
                .font(.system(size: 17, design: .serif))
                .foregroundStyle(AppColors.textPrimary)
                .lineSpacing(4)

            Text(record.authorLine)
                .font(.system(size: 13))
                .foregroundStyle(AppColors.textTertiary)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.top, Spacing.sm)

            Divider()
                .padding(.vertical, Spacing.md)

            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(spacing: Spacing.sm) {
                    Text("宜：")
                        .font(.system(size: 14))
                        .foregroundStyle(AppColors.yi)
                    Text(record.recommended)
                        .font(.system(size: 14))
                        .foregroundStyle(AppColors.textSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }

                HStack(spacing: Spacing.sm) {
                    Text("忌：")
                        .font(.system(size: 14))
                        .foregroundStyle(AppColors.ji)
                    Text(record.avoided)
                        .font(.system(size: 14))
                        .foregroundStyle(AppColors.textSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }
            }

            HStack(spacing: 6) {
                ForEach(QuoteMood.allCases) { mood in
                    HStack(spacing: 4) {
                        Circle()
                            .fill(AppColors.mood(mood))
                            .frame(width: 5, height: 5)

                        Text(mood.label)
                            .font(.system(size: 10.5))
                            .foregroundStyle(mood == record.mood ? AppColors.textPrimary : AppColors.textSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 28)
                    .background(
                        RoundedRectangle(cornerRadius: 999)
                            .fill(mood == record.mood ? AppColors.moodFill(mood, opacity: 0.14) : .clear)
                    )
                }
            }
            .padding(.top, Spacing.md)
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity)
        .aspectRatio(0.955, contentMode: .fit)
        .background(AppColors.backgroundPrimary)
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .stroke(AppColors.borderSecondary, lineWidth: 0.5)
        )
    }
}

struct WidgetPreviewLargeRecord {
    let quoteText: String
    let quoteAuthor: String
    let quoteWork: String?
    let recommended: String
    let avoided: String
    let mood: QuoteMood?

    var authorLine: String {
        if let quoteWork, !quoteWork.isEmpty {
            return "— \(quoteAuthor)《\(quoteWork)》"
        }

        return "— \(quoteAuthor)"
    }

    static let preview = WidgetPreviewLargeRecord(
        quoteText: "窗镜子里浮现着冰冷而硕大的雪花，在敞开领口、揩拭脖颈的驹子周围，飘扬着一条条银线。雪光把房间里的轮廓衬得更浅，仿佛有人把呼吸也停在了玻璃的另一面。",
        quoteAuthor: "加西亚·马尔克斯",
        quoteWork: nil,
        recommended: "出门走一段不常走的路，看陌生的窗口",
        avoided: "用沉默代替真正想说的话",
        mood: .contemplative
    )
}

extension WidgetPreviewLargeRecord {
    init(record: DailyRecord) {
        self.init(
            quoteText: record.quoteText,
            quoteAuthor: record.quoteAuthor,
            quoteWork: record.quoteWork,
            recommended: record.recommended,
            avoided: record.avoided,
            mood: record.mood
        )
    }
}

#Preview("Large") {
    WidgetPreviewLarge()
        .padding()
}
