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
    var createdAt: Date

    init(
        id: UUID = UUID(),
        title: String,
        date: Date,
        createdAt: Date = .now
    ) {
        self.id = id
        self.title = title
        self.date = date
        self.createdAt = createdAt
    }
}
