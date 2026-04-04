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

    enum CodingKeys: String, CodingKey {
        case geo
        case weather
        case profile
        case preferences
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(geo, forKey: .geo)
        try container.encodeIfPresent(weather, forKey: .weather)
        try container.encode(profile, forKey: .profile)
        try container.encode(preferences, forKey: .preferences)
    }

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
        var anniversary: AnniversaryItem?

        struct AnniversaryItem: Codable, Sendable, Equatable {
            var name: String
            var month: Int
            var day: Int
        }

        enum CodingKeys: String, CodingKey {
            case mood
            case moodHistory = "mood_history"
            case anniversary
        }

        public func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encodeIfPresent(mood, forKey: .mood)
            try container.encode(moodHistory, forKey: .moodHistory)
            try container.encodeIfPresent(anniversary, forKey: .anniversary)
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
