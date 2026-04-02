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
    var recommended: [String]
    var avoided: [String]
    var moodRawValue: String
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
        recommended: [String] = [],
        avoided: [String] = [],
        mood: DailyMood = .calm,
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
        self.moodRawValue = mood.rawValue
        self.weatherSummary = weatherSummary
        self.note = note
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    var mood: DailyMood {
        get { DailyMood(rawValue: moodRawValue) ?? .calm }
        set {
            moodRawValue = newValue.rawValue
            updatedAt = .now
        }
    }
}

enum DailyMood: String, Codable, CaseIterable, Sendable {
    case calm
    case joyful
    case focused
    case reflective
    case tender
}

private extension Calendar {
    static let oracle = Calendar(identifier: .gregorian)
}
