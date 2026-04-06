//
//  OracleWidgetSmall.swift
//  daily-oracle
//
//  Small (2×2) Widget View
//

import SwiftUI
import WidgetKit

/// 小组件视图 (2×2)
struct OracleWidgetSmallView: View {
    let entry: OracleWidgetEntry

    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme

    private var authorThreshold: Int { 25 }
    private var workTitleThreshold: Int { 4 }

    var body: some View {
        quoteContent(showsAuthor: entry.quoteText.count <= authorThreshold)
            .padding(Spacing.md)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(backgroundColor)
            .clipShape(RoundedRectangle(cornerRadius: 22))
            .overlay(
                RoundedRectangle(cornerRadius: 22)
                    .stroke(borderColor, lineWidth: 0.5)
            )
    }

    private func quoteContent(showsAuthor: Bool) -> some View {
        VStack(spacing: showsAuthor ? Spacing.sm : 0) {
            Text(entry.quoteText)
                .font(.system(size: 15, weight: .regular, design: .serif))
                .foregroundStyle(textPrimaryColor)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .frame(maxHeight: .infinity, alignment: .center)

            if showsAuthor {
                Text(authorLine)
                    .font(.system(size: 12))
                    .foregroundStyle(textTertiaryColor)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var authorLine: String {
        if let work = entry.quoteWork, work.count <= workTitleThreshold {
            return "—— \(entry.quoteAuthor)《\(work)》"
        }
        return "—— \(entry.quoteAuthor)"
    }

    // MARK: - Colors

    private var backgroundColor: Color {
        colorScheme == .dark
            ? Color(white: 0.11)
            : Color(white: 0.97)
    }

    private var textPrimaryColor: Color {
        colorScheme == .dark
            ? Color(white: 0.92)
            : Color(white: 0.13)
    }

    private var textTertiaryColor: Color {
        colorScheme == .dark
            ? Color(white: 0.50)
            : Color(white: 0.45)
    }

    private var borderColor: Color {
        colorScheme == .dark
            ? Color(white: 0.20)
            : Color(white: 0.88)
    }
}

// MARK: - Widget Definition

struct OracleWidgetSmall: Widget {
    let kind: String = "OracleWidgetSmall"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: OracleWidgetProvider()) { entry in
            OracleWidgetSmallView(entry: entry)
        }
        .configurationDisplayName("日签·小")
        .description("展示今日名句（2×2）")
        .supportedFamilies([.systemSmall])
    }
}

// MARK: - Preview

#Preview(as: .systemSmall) {
    OracleWidgetSmall()
} timeline: {
    OracleWidgetEntry.preview
    OracleWidgetEntry.placeholder
}
