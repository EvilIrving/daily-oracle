import SwiftUI

struct WidgetPreviewSmall: View {
    private let quote =
        "窗镜子里浮现着冰冷而硕大的雪花，在敞"
    private let author = "萧红"
    private let workTitle = "生死场"
    private let authorThreshold = 25
    private let workTitleThreshold = 4

    var body: some View {
        quoteContent(showsAuthor: quote.count <= authorThreshold)
        .padding(Spacing.md)
        .frame(maxWidth: .infinity)
        .aspectRatio(1, contentMode: .fit)
        .background(AppColors.backgroundPrimary)
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .stroke(AppColors.borderSecondary, lineWidth: 0.5)
        )
    }

    private func quoteContent(showsAuthor: Bool) -> some View {
        VStack(spacing: showsAuthor ? Spacing.sm : 0) {
            Text(quote)
                .font(.system(size: 15, weight: .regular, design: .serif))
                .foregroundStyle(AppColors.textPrimary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .frame(maxHeight: .infinity, alignment: .center)

            if showsAuthor {
                Text(authorLine)
                    .font(.system(size: 12))
                    .foregroundStyle(AppColors.textTertiary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var authorLine: String {
        if workTitle.count <= workTitleThreshold {
            return "—— \(author)《\(workTitle)》"
        }

        return "—— \(author)"
    }
}

#Preview("Small") {
    WidgetPreviewSmall()
        .padding()
}
