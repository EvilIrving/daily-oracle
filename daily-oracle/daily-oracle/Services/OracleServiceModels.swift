//
//  OracleServiceModels.swift
//  daily-oracle
//

import Foundation
import CoreLocation

nonisolated struct OracleEdgeRequest: Codable, Sendable {
    var geo: Geo
    var weather: Weather
    var profile: Profile
    var preferences: Preferences

    nonisolated struct Geo: Codable, Sendable {
        var lng: Double
        var lat: Double
    }

    nonisolated struct Weather: Codable, Sendable {
        var temperature: Double
        var condition: String
        var wind: Double?
    }

    nonisolated struct Profile: Codable, Sendable {
        var lang: String
        var region: String
        var pro: Bool
    }

    nonisolated struct Preferences: Codable, Sendable {
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

nonisolated struct OracleEdgeResponse: Codable, Sendable {
    var quote: Quote
    var almanac: Almanac
    var date: String

    nonisolated struct Quote: Codable, Sendable {
        var id: String
        var text: String
        var author: String?
        var work: String?
        var year: Int?
    }

    nonisolated struct Almanac: Codable, Sendable {
        var yi: String
        var ji: String
    }
}

nonisolated struct WeatherSnapshot: Sendable {
    var temperature: Double
    var condition: String
    var windSpeed: Double?
    var summary: String
}

nonisolated struct LocationSnapshot: Sendable {
    var latitude: Double
    var longitude: Double
    var cityName: String?
}

extension LocationSnapshot {
    init(location: CLLocation, cityName: String? = nil) {
        self.latitude = location.coordinate.latitude
        self.longitude = location.coordinate.longitude
        self.cityName = cityName
    }
}
