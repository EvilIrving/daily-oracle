//
//  OracleWidgetLarge.swift
//  daily-oracle
//
//  Large (4×4) Widget View
//

import SwiftUI
import WidgetKit

/// 大组件视图 (4×4)
struct OracleWidgetLargeView: View {
    let entry: OracleWidgetEntry

    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // 日期头部
            HStack {
                Text(formattedDate)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(textSecondaryColor)

                Spacer()

                if let mood = entry.mood {
                    Text(mood.displayName)
                        .font(.system(size: 12))
                        .foregroundStyle(moodColor(mood))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(moodColor(mood).opacity(0.12))
                        .clipShape(Capsule())
                }
            }
            .padding(.bottom, Spacing.lg)

            // 名句区域
            VStack(spacing: Spacing.md) {
                Text(entry.quoteText)
                    .font(.system(size: 18, weight: .regular, design: .serif))
                    .foregroundStyle(textPrimaryColor)
                    .multilineTextAlignment(.center)
                    .lineSpacing(6)
                    .frame(maxWidth: .infinity, minHeight: 80)

                Text(authorLine)
                    .font(.system(size: 14))
                    .foregroundStyle(textTertiaryColor)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .padding(.bottom, Spacing.lg)

            Divider()
                .padding(.bottom, Spacing.lg)

            // 宜忌区域
            VStack(alignment: .leading, spacing: Spacing.md) {
                HStack(alignment: .top, spacing: Spacing.sm) {
                    Text("宜")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white)
                        .frame(width: 24, height: 24)
                        .background(yiColor)
                        .clipShape(RoundedRectangle(cornerRadius: 6))

                    Text(entry.recommended)
                        .font(.system(size: 15))
                        .foregroundStyle(textPrimaryColor)
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                HStack(alignment: .top, spacing: Spacing.sm) {
                    Text("忌")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white)
                        .frame(width: 24, height: 24)
                        .background(jiColor)
                        .clipShape(RoundedRectangle(cornerRadius: 6))

                    Text(entry.avoided)
                        .font(.system(size: 15))
                        .foregroundStyle(textPrimaryColor)
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }

            Spacer()
        }
        .padding(Spacing.lg)
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

    private var formattedDate: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "M月d日 EEEE"
        return formatter.string(from: entry.date)
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
            : Color(white: 0.45)
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

    private func moodColor(_ mood: QuoteMood) -> Color {
        switch mood {
        case .energetic:  return Color(red: 0.95, green: 0.45, blue: 0.25)
        case .calm:       return Color(red: 0.25, green: 0.55, blue: 0.85)
        case .melancholy: return Color(red: 0.55, green: 0.45, blue: 0.65)
        case .hopeful:    return Color(red: 0.35, green: 0.65, blue: 0.45)
        case .reflective: return Color(red: 0.65, green: 0.55, blue: 0.35)
        }
    }
}

// MARK: - Widget Definition

struct OracleWidgetLarge: Widget {
    let kind: String = "OracleWidgetLarge"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: OracleWidgetProvider()) { entry in
            OracleWidgetLargeView(entry: entry)
        }
        .configurationDisplayName("日签·大")
        .description("展示完整日签内容（4×4）")
        .supportedFamilies([.systemLarge])
    }
}

// MARK: - Preview

#Preview(as: .systemLarge) {
    OracleWidgetLarge()
} timeline: {
    OracleWidgetEntry.preview
    OracleWidgetEntry.placeholder
}
