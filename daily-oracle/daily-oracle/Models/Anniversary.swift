//
//  Anniversary.swift
//  daily-oracle
//

import Foundation
import SwiftData

@Model
final class Anniversary {
    @Attribute(.unique) var id: UUID
    var title: String
    var date: Date
    var note: String?
    var isLunar: Bool
    var remindAtMidnight: Bool
    var createdAt: Date

    init(
        id: UUID = UUID(),
        title: String,
        date: Date,
        note: String? = nil,
        isLunar: Bool = false,
        remindAtMidnight: Bool = true,
        createdAt: Date = .now
    ) {
        self.id = id
        self.title = title
        self.date = date
        self.note = note
        self.isLunar = isLunar
        self.remindAtMidnight = remindAtMidnight
        self.createdAt = createdAt
    }
}
