//
//  OracleWidgetEntry.swift
//  daily-oracle
//
//  Widget Timeline Entry
//

import Foundation
import WidgetKit

/// Widget 展示的数据结构
struct OracleWidgetEntry: TimelineEntry {
    let date: Date
    let quoteText: String
    let quoteAuthor: String
    let quoteWork: String?
    let recommended: String
    let avoided: String
    let moodRawValue: String?

    var mood: QuoteMood? {
        guard let raw = moodRawValue else { return nil }
        return QuoteMood(rawValue: raw)
    }
}

// MARK: - Preview Data

extension OracleWidgetEntry {
    static let preview = OracleWidgetEntry(
        date: .now,
        quoteText: "窗镜子里浮现着冰冷而硕大的雪花，在敞开领口、揩拭脖颈的驹子周围，飘扬着一条条银线。",
        quoteAuthor: "川端康成",
        quoteWork: "雪国",
        recommended: "在自然光下读几页纸质书",
        avoided: "把休息当成需要被证明才能拥有的东西",
        moodRawValue: "calm"
    )

    static let previewShort = OracleWidgetEntry(
        date: .now,
        quoteText: "黑夜给了我黑色的眼睛，我却用它寻找光明。",
        quoteAuthor: "顾城",
        quoteWork: "一代人",
        recommended: "早起看日出",
        avoided: "熬夜刷手机",
        moodRawValue: "hopeful"
    )

    static let placeholder = OracleWidgetEntry(
        date: .now,
        quoteText: "今日名句加载中...",
        quoteAuthor: "",
        quoteWork: nil,
        recommended: "保持耐心",
        avoided: "焦虑急躁",
        moodRawValue: nil
    )
}
