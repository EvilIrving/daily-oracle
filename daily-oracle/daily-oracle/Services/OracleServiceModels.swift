//
//  OracleServiceModels.swift
//  daily-oracle
//

import Foundation
import CoreLocation

struct OracleEdgeRequest: Codable, Sendable {
    var geo: Geo
    var weather: Weather
    var profile: Profile
    var preferences: Preferences

    struct Geo: Codable, Sendable {
        var lng: Double
        var lat: Double
    }

    struct Weather: Codable, Sendable {
        var temperature: Double
        var condition: String
        var wind: Double?
    }

    struct Profile: Codable, Sendable {
        var lang: String
        var region: String
        var pro: Bool
    }

    struct Preferences: Codable, Sendable {
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

struct OracleEdgeResponse: Codable, Sendable {
    var quote: Quote?
    var almanac: Almanac
    var date: String

    struct Quote: Codable, Sendable {
        var id: String
        var text: String
        var author: String?
        var work: String?
        var year: Int?
        var mood: [String]
        var themes: [String]
    }

    struct Almanac: Codable, Sendable {
        var yi: String
        var ji: String
    }
}

struct WeatherSnapshot: Sendable {
    var temperature: Double
    var condition: String
    var windSpeed: Double?
    var summary: String
}

struct LocationSnapshot: Sendable {
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
