//
//  DailyRecord.swift
//  daily-oracle
//

import Foundation
import SwiftData

@Model
final class DailyRecord {
    @Attribute(.unique) var id: UUID
    var date: Date
    var quoteText: String
    var quoteAuthor: String
    var quoteWork: String?
    var recommended: String
    var avoided: String
    var moodRawValue: String?
    var weatherSummary: String?
    var note: String?
    var createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        date: Date,
        quoteText: String,
        quoteAuthor: String,
        quoteWork: String? = nil,
        recommended: String = "",
        avoided: String = "",
        mood: QuoteMood? = nil,
        weatherSummary: String? = nil,
        note: String? = nil,
        createdAt: Date = .now,
        updatedAt: Date = .now
    ) {
        self.id = id
        self.date = Calendar.oracle.startOfDay(for: date)
        self.quoteText = quoteText
        self.quoteAuthor = quoteAuthor
        self.quoteWork = quoteWork
        self.recommended = recommended
        self.avoided = avoided
        self.moodRawValue = mood?.rawValue
        self.weatherSummary = weatherSummary
        self.note = note
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    var mood: QuoteMood? {
        get {
            guard let raw = moodRawValue, !raw.isEmpty else { return nil }
            return QuoteMood(rawValue: raw)
        }
        set {
            moodRawValue = newValue?.rawValue
            updatedAt = .now
        }
    }
}
