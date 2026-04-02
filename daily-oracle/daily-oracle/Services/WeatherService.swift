//
//  WeatherService.swift
//  daily-oracle
//

import Foundation
import CoreLocation
#if canImport(WeatherKit)
import WeatherKit
#endif

protocol WeatherServicing: Sendable {
    func weather(for location: CLLocation) async throws -> WeatherSnapshot
}

struct WeatherService: WeatherServicing {
    enum Mode: Sendable {
        case mock
        #if canImport(WeatherKit)
        case live
        #endif
    }

    private let mode: Mode

    init(mode: Mode = .mock) {
        self.mode = mode
    }

    func weather(for location: CLLocation) async throws -> WeatherSnapshot {
        switch mode {
        case .mock:
            return .init(
                temperature: 21,
                condition: "多云",
                windSpeed: 3.2,
                summary: "多云 21°C"
            )
        #if canImport(WeatherKit)
        case .live:
            let service = WeatherKit.WeatherService.shared
            let weather = try await service.weather(for: location)
            let current = weather.currentWeather
            let temperature = current.temperature.converted(to: .celsius).value
            let wind = current.wind.speed.converted(to: .metersPerSecond).value

            return .init(
                temperature: temperature,
                condition: current.condition.description,
                windSpeed: wind,
                summary: "\(current.condition.description) \(Int(temperature.rounded()))°C"
            )
        #endif
        }
    }
}
