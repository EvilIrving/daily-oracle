//
//  OracleWidgetMedium.swift
//  daily-oracle
//
//  Medium (4×2) Widget View
//

import SwiftUI
import WidgetKit

/// 中组件视图 (4×2)
struct OracleWidgetMediumView: View {
    let entry: OracleWidgetEntry

    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(entry.quoteText)
                .font(.system(size: 15, design: .serif))
                .foregroundStyle(textPrimaryColor)
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineSpacing(3)

            Text(authorLine)
                .font(.system(size: 13))
                .foregroundStyle(textTertiaryColor)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.top, Spacing.sm)

            Divider()
                .padding(.vertical, Spacing.md)

            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(spacing: Spacing.sm) {
                    Text("宜：")
                        .font(.system(size: 14))
                        .foregroundStyle(yiColor)
                    Text(entry.recommended)
                        .font(.system(size: 14))
                        .foregroundStyle(textSecondaryColor)
                        .lineLimit(1)
                }

                HStack(spacing: Spacing.sm) {
                    Text("忌：")
                        .font(.system(size: 14))
                        .foregroundStyle(jiColor)
                    Text(entry.avoided)
                        .font(.system(size: 14))
                        .foregroundStyle(textSecondaryColor)
                        .lineLimit(1)
                }
            }
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(backgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .stroke(borderColor, lineWidth: 0.5)
        )
    }

    private var authorLine: String {
        if let work = entry.quoteWork, !work.isEmpty {
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

    private var textSecondaryColor: Color {
        colorScheme == .dark
            ? Color(white: 0.65)
            : Color(white: 0.35)
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

    private var yiColor: Color {
        Color(red: 0.20, green: 0.60, blue: 0.35)
    }

    private var jiColor: Color {
        Color(red: 0.75, green: 0.25, blue: 0.25)
    }
}

// MARK: - Widget Definition

struct OracleWidgetMedium: Widget {
    let kind: String = "OracleWidgetMedium"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: OracleWidgetProvider()) { entry in
            OracleWidgetMediumView(entry: entry)
        }
        .configurationDisplayName("日签·中")
        .description("展示今日名句与宜忌（4×2）")
        .supportedFamilies([.systemMedium])
    }
}

// MARK: - Preview

#Preview(as: .systemMedium) {
    OracleWidgetMedium()
} timeline: {
    OracleWidgetEntry.preview
    OracleWidgetEntry.placeholder
}
