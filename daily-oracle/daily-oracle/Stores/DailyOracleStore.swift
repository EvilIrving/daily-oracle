//
//  DailyOracleStore.swift
//  daily-oracle
//

import Foundation
import Observation
import SwiftData
import OSLog

@MainActor
@Observable
final class DailyOracleStore {
    private(set) var isLoading = false
    private(set) var lastErrorMessage: String?
    private(set) var lastResponseDate: Date?

    private let edgeService: any EdgeFunctionServicing

    init(
        edgeService: any EdgeFunctionServicing
    ) {
        self.edgeService = edgeService
    }

    func refresh(using modelContext: ModelContext, config: UserConfig?) async {
        isLoading = true
        lastErrorMessage = nil
        defer { isLoading = false }

        Log.store.info("Refresh started")
        do {
            let request = makeRequest(config: config, modelContext: modelContext)
            let response = try await edgeService.fetchDailyOracle(request: request)

            try upsertDailyRecord(with: response, modelContext: modelContext)

            if let config {
                config.lastSyncedAt = .now
            } else {
                modelContext.insert(UserConfig(lastSyncedAt: .now))
            }

            try modelContext.save()
            lastResponseDate = oracleDate(from: response.date)
            Log.store.info("Refresh completed for \(response.date, privacy: .public)")
        } catch {
            Log.store.error("Refresh failed: \(error.localizedDescription, privacy: .public)")
            lastErrorMessage = error.localizedDescription
        }
    }

    private func makeRequest(config: UserConfig?, modelContext: ModelContext) -> OracleEdgeRequest {
        return OracleEdgeRequest(
            geo: nil,
            weather: nil,
            profile: .init(
                lang: Locale.preferredLanguages.first?.prefix(2).description ?? "zh",
                region: Locale.current.region?.identifier ?? "CN",
                pro: false
            ),
            preferences: .init(
                mood: config?.preferredQuoteMoodRaw,
                moodHistory: [],
                anniversary: todayAnniversary(from: modelContext)
            )
        )
    }

    private func todayAnniversary(from modelContext: ModelContext) -> OracleEdgeRequest.Preferences.AnniversaryItem? {
        let descriptor = FetchDescriptor<Anniversary>()

        do {
            let todayMonth = Calendar.oracle.component(.month, from: .now)
            let todayDay = Calendar.oracle.component(.day, from: .now)

            let matches = try modelContext.fetch(descriptor).filter { anniversary in
                Calendar.oracle.component(.month, from: anniversary.date) == todayMonth &&
                Calendar.oracle.component(.day, from: anniversary.date) == todayDay
            }

            guard matches.count <= 1 else {
                Log.store.error("Found duplicate anniversaries for today: \(matches.count, privacy: .public)")
                return nil
            }

            guard let anniversary = matches.first else {
                return nil
            }

            let components = Calendar.oracle.dateComponents([.month, .day], from: anniversary.date)
            return OracleEdgeRequest.Preferences.AnniversaryItem(
                name: anniversary.title,
                month: components.month ?? 1,
                day: components.day ?? 1
            )
        } catch {
            Log.store.error("Failed to load anniversary: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    private func upsertDailyRecord(with response: OracleEdgeResponse, modelContext: ModelContext) throws {
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
            existing.updatedAt = .now
        } else {
            modelContext.insert(
                DailyRecord(
                    date: date,
                    quoteText: quoteText,
                    quoteAuthor: quoteAuthor,
                    quoteWork: quote.work,
                    recommended: recommended,
                    avoided: avoided
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
