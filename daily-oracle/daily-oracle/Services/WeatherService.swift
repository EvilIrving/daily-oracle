//
//  WeatherService.swift
//  daily-oracle
//

import Foundation
import CoreLocation
import OSLog
#if canImport(WeatherKit)
import WeatherKit
#endif

protocol WeatherServicing: Sendable {
    func weather(for location: CLLocation) async throws -> WeatherSnapshot
}

struct WeatherService: WeatherServicing {
    func weather(for location: CLLocation) async throws -> WeatherSnapshot {
        #if canImport(WeatherKit)
        let service = WeatherKit.WeatherService.shared
        do {
            let weather = try await service.weather(for: location)
            let current = weather.currentWeather
            let temperature = current.temperature.converted(to: .celsius).value
            let wind = current.wind.speed.converted(to: .metersPerSecond).value
            Log.weather.info("Weather: \(current.condition.description, privacy: .public) \(Int(temperature.rounded()))°C")
            return .init(
                temperature: temperature,
                condition: current.condition.description,
                windSpeed: wind,
                summary: "\(current.condition.description) \(Int(temperature.rounded()))°C"
            )
        } catch {
            Log.weather.error("WeatherKit failed: \(error.localizedDescription, privacy: .public)")
            throw error
        }
        #else
        throw WeatherServiceError.unavailable
        #endif
    }
}

enum WeatherServiceError: LocalizedError {
    case unavailable

    var errorDescription: String? {
        "当前平台不可用 WeatherKit。"
    }
}
