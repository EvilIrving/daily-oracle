//
//  QuoteCard.swift
//  daily-oracle
//

import SwiftUI

/// 名句卡片：正文 + `quote_mood` 偏好标签（与 Edge 返回正文无关；可点选写入 `UserConfig.preferredQuoteMoodRaw`）。
struct QuoteCard: View {
    let quoteText: String
    let authorLine: String
    let moodTags: [String]
    /// 与 `UserConfig.preferredQuoteMoodRaw` 一致时高亮，表示将用于下次请求。
    var preferredTagRaw: String?
    var onTapMoodTag: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(quoteText)
                .font(.title3)

            if !authorLine.isEmpty {
                Text(authorLine)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            if !moodTags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.xs) {
                        ForEach(moodTags, id: \.self) { raw in
                            moodChip(raw: raw)
                        }
                    }
                }
            }
        }
    }

    private func moodChip(raw: String) -> some View {
        let selected = preferredTagRaw == raw
        return Button {
            onTapMoodTag(raw)
        } label: {
            HStack(spacing: 4) {
                if let m = QuoteMood(rawValue: raw) {
                    Image(systemName: m.icon)
                        .imageScale(.small)
                }
                Text(QuoteMood.displayLabel(forRaw: raw))
                    .font(.caption.weight(.medium))
            }
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.xs)
            .background(QuoteMood.chipColor(forRaw: raw))
            .foregroundStyle(QuoteMood.chipForeground(forRaw: raw))
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(selected ? Color.accentColor : .clear, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("名句标签 \(QuoteMood.displayLabel(forRaw: raw))")
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }
}

#Preview("QuoteCard") {
    QuoteCard(
        quoteText: "风把今天吹得很薄。",
        authorLine: "作者 · 作品",
        moodTags: ["calm", "philosophical"],
        preferredTagRaw: "calm",
        onTapMoodTag: { _ in }
    )
    .padding()
}
