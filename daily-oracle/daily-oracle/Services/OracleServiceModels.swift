//
//  OracleServiceModels.swift
//  daily-oracle
//

import Foundation

nonisolated struct OracleEdgeRequest: Codable, Sendable, Equatable {
    var geo: Geo?
    var weather: Weather?
    var profile: Profile
    var preferences: Preferences

    nonisolated struct Geo: Codable, Sendable, Equatable {
        var lng: Double
        var lat: Double
    }

    nonisolated struct Weather: Codable, Sendable, Equatable {
        var temperature: Double
        var condition: String
        var wind: Double?
    }

    nonisolated struct Profile: Codable, Sendable, Equatable {
        var lang: String
        var region: String
        var pro: Bool
    }

    nonisolated struct Preferences: Codable, Sendable, Equatable {
        var mood: String?
        var moodHistory: [String]
        var genreHistory: [String]

        enum CodingKeys: String, CodingKey {
            case mood
            case moodHistory = "mood_history"
            case genreHistory = "genre_history"
        }
    }
}

nonisolated struct OracleEdgeResponse: Codable, Sendable, Equatable {
    var quote: Quote
    var almanac: Almanac
    var date: String

    nonisolated struct Quote: Codable, Sendable, Equatable {
        var id: String
        var text: String
        var author: String?
        var work: String?
        var year: Int?
    }

    nonisolated struct Almanac: Codable, Sendable, Equatable {
        var yi: String
        var ji: String
    }
}
