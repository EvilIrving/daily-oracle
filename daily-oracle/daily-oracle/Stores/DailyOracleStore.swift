//
//  DailyOracleStore.swift
//  daily-oracle
//

import Foundation
import Observation
import SwiftData
import CoreLocation
import OSLog

@MainActor
@Observable
final class DailyOracleStore {
    private(set) var isLoading = false
    private(set) var lastErrorMessage: String?
    private(set) var lastResponseDate: Date?

    private let edgeService: any EdgeFunctionServicing
    private let weatherService: any WeatherServicing
    private let locationService: any LocationServicing

    init(
        edgeService: any EdgeFunctionServicing,
        weatherService: any WeatherServicing,
        locationService: any LocationServicing
    ) {
        self.edgeService = edgeService
        self.weatherService = weatherService
        self.locationService = locationService
    }

    func refresh(using modelContext: ModelContext, config: UserConfig?) async {
        isLoading = true
        lastErrorMessage = nil
        defer { isLoading = false }

        Log.store.info("Refresh started")
        do {
            let location = try await locationService.currentLocation()
            let weather = try await weatherService.weather(
                for: CLLocation(latitude: location.latitude, longitude: location.longitude)
            )
            let request = makeRequest(location: location, weather: weather, config: config)
            let response = try await edgeService.fetchDailyOracle(request: request)

            try upsertDailyRecord(
                with: response,
                weather: weather,
                modelContext: modelContext
            )

            if let config {
                config.cityName = location.cityName ?? config.cityName
                config.latitude = location.latitude
                config.longitude = location.longitude
                config.lastSyncedAt = .now
            } else {
                modelContext.insert(
                    UserConfig(
                        cityName: location.cityName,
                        latitude: location.latitude,
                        longitude: location.longitude,
                        lastSyncedAt: .now
                    )
                )
            }

            try modelContext.save()
            lastResponseDate = oracleDate(from: response.date)
            Log.store.info("Refresh completed for \(response.date, privacy: .public)")
        } catch {
            Log.store.error("Refresh failed: \(error.localizedDescription, privacy: .public)")
            lastErrorMessage = error.localizedDescription
        }
    }

    private func makeRequest(
        location: LocationSnapshot,
        weather: WeatherSnapshot,
        config: UserConfig?
    ) -> OracleEdgeRequest {
        OracleEdgeRequest(
            geo: .init(lng: location.longitude, lat: location.latitude),
            weather: .init(
                temperature: weather.temperature,
                condition: weather.condition,
                wind: weather.windSpeed
            ),
            profile: .init(
                lang: Locale.preferredLanguages.first?.prefix(2).description ?? "zh",
                region: Locale.current.region?.identifier ?? "CN",
                pro: false
            ),
            preferences: .init(
                mood: config?.preferredQuoteMoodRaw,
                moodHistory: [],
                genreHistory: config?.preferredGenres ?? []
            )
        )
    }

    private func upsertDailyRecord(
        with response: OracleEdgeResponse,
        weather: WeatherSnapshot,
        modelContext: ModelContext
    ) throws {
        let date = oracleDate(from: response.date)
        let descriptor = FetchDescriptor<DailyRecord>(
            predicate: #Predicate<DailyRecord> { record in
                record.date == date
            }
        )
        let existing = try modelContext.fetch(descriptor).first
        let quote = response.quote

        let quoteText = quote.text
        let quoteAuthor = quote.author ?? ""
        let recommended = response.almanac.yi
        let avoided = response.almanac.ji

        if let existing {
            existing.quoteText = quoteText
            existing.quoteAuthor = quoteAuthor
            existing.quoteWork = quote.work
            existing.recommended = recommended
            existing.avoided = avoided
            existing.weatherSummary = weather.summary
            existing.updatedAt = .now
        } else {
            modelContext.insert(
                DailyRecord(
                    date: date,
                    quoteText: quoteText,
                    quoteAuthor: quoteAuthor,
                    quoteWork: quote.work,
                    recommended: recommended,
                    avoided: avoided,
                    weatherSummary: weather.summary
                )
            )
        }
    }

    private func oracleDate(from value: String) -> Date {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value).map { Calendar.oracle.startOfDay(for: $0) } ?? Calendar.oracle.startOfDay(for: .now)
    }
}
