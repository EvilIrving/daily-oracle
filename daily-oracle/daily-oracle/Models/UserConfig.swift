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
    var prefersReducedMotion: Bool
    var selectedTheme: String
    var preferredSourceLanguages: [String]
    var preferredGenres: [String]
    var cityName: String?
    var latitude: Double?
    var longitude: Double?
    var lastSyncedAt: Date?

    init(
        id: UUID = UUID(uuidString: "D5A4CFB4-0DD3-4AE0-A91F-8B45D34C5F48") ?? UUID(),
        preferredFontName: String = "SourceHanSerifCN-Regular",
        prefersReducedMotion: Bool = false,
        selectedTheme: String = "system",
        preferredSourceLanguages: [String] = ["zh"],
        preferredGenres: [String] = [],
        cityName: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        lastSyncedAt: Date? = nil
    ) {
        self.id = id
        self.preferredFontName = preferredFontName
        self.prefersReducedMotion = prefersReducedMotion
        self.selectedTheme = selectedTheme
        self.preferredSourceLanguages = preferredSourceLanguages
        self.preferredGenres = preferredGenres
        self.cityName = cityName
        self.latitude = latitude
        self.longitude = longitude
        self.lastSyncedAt = lastSyncedAt
    }
}
