//
//  UserConfig.swift
//  daily-oracle
//

import Foundation
import SwiftData

@Model
final class UserConfig {
    @Attribute(.unique) var id: UUID
    var preferredFontName: String
    var selectedTheme: String
    var preferredSourceLanguages: [String]
    var lastSyncedAt: Date?

    init(
        id: UUID = UUID(uuidString: "D5A4CFB4-0DD3-4AE0-A91F-8B45D34C5F48") ?? UUID(),
        preferredFontName: String = "SourceHanSerifCN-Regular",
        selectedTheme: String = "system",
        preferredSourceLanguages: [String] = ["zh"],
        lastSyncedAt: Date? = nil
    ) {
        self.id = id
        self.preferredFontName = preferredFontName
        self.selectedTheme = selectedTheme
        self.preferredSourceLanguages = preferredSourceLanguages
        self.lastSyncedAt = lastSyncedAt
    }
}
