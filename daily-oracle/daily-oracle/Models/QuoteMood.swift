//
//  QuoteMood.swift
//  daily-oracle
//
//  与 Supabase `quote_mood`（server/supabase/schema.sql）一致；App 用于选句偏好 UI，名句正文不由 Edge 返回 mood。
//

import SwiftUI

enum QuoteMood: String, CaseIterable, Identifiable, Codable, Sendable {
    case calm
    case happy
    case sad
    case anxious
    case angry
    case resilient
    case romantic
    case philosophical

    var id: String { rawValue }

    /// 标签短文案（中文），用于名句偏好标签 UI。
    var label: String {
        switch self {
        case .calm: return "平静"
        case .happy: return "明快"
        case .sad: return "低落"
        case .anxious: return "焦虑"
        case .angry: return "愤怒"
        case .resilient: return "坚韧"
        case .romantic: return "温柔"
        case .philosophical: return "哲思"
        }
    }

    var color: Color {
        AppColors.mood(self)
    }

    var icon: String {
        switch self {
        case .calm: "moon.stars"
        case .happy: "sun.max"
        case .sad: "cloud.rain"
        case .anxious: "wind"
        case .angry: "flame"
        case .resilient: "leaf"
        case .romantic: "heart"
        case .philosophical: "sparkles"
        }
    }
}

extension QuoteMood {
    static func displayLabel(forRaw raw: String) -> String {
        QuoteMood(rawValue: raw)?.label ?? raw
    }

    static func chipColor(forRaw raw: String) -> Color {
        AppColors.moodFill(QuoteMood(rawValue: raw), opacity: 0.35)
    }

    static func chipForeground(forRaw raw: String) -> Color {
        AppColors.mood(QuoteMood(rawValue: raw))
    }
}
