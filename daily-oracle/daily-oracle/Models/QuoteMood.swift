//
//  QuoteMood.swift
//  daily-oracle
//
//  与 Supabase `quote_mood`（server/supabase/schema.sql）一致；App 用于选句偏好 UI，名句正文不由 Edge 返回 mood。
//

import SwiftUI

enum QuoteMood: String, CaseIterable, Identifiable, Codable, Sendable {
    case calm
    case sad
    case anxious
    case happy
    case hopeful
    case tender
    case contemplative
    case angry

    var id: String { rawValue }

    /// 标签短文案（中文），用于名句偏好标签 UI。
    var label: String {
        switch self {
        case .calm: return "静"
        case .sad: return "失落"
        case .anxious: return "不安"
        case .happy: return "轻盈"
        case .hopeful: return "希望"
        case .tender: return "温柔"
        case .contemplative: return "沉淀"
        case .angry: return "压着"
        }
    }

    var color: Color {
        AppColors.mood(self)
    }

    var icon: String {
        switch self {
        case .calm: "moon.stars"
        case .sad: "cloud.rain"
        case .anxious: "wind"
        case .happy: "sun.max"
        case .hopeful: "sunrise"
        case .tender: "heart"
        case .contemplative: "sparkles"
        case .angry: "flame"
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
