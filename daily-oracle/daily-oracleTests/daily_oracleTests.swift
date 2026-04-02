//
//  daily_oracleTests.swift
//  daily-oracleTests
//
//  Created by Cain on 2026/4/2.
//

import Foundation
import Testing
import SwiftData
@testable import daily_oracle

struct daily_oracleTests {
    @Test
    @MainActor
    func previewContainerSeedsExpectedModels() throws {
        let container = try OracleModelContainer.makeContainer(inMemory: true, seedWithSamples: true)
        let context = ModelContext(container)

        let records = try context.fetch(FetchDescriptor<DailyRecord>())
        let anniversaries = try context.fetch(FetchDescriptor<Anniversary>())
        let configs = try context.fetch(FetchDescriptor<UserConfig>())

        #expect(records.count == 1)
        #expect(anniversaries.count == 1)
        #expect(configs.count == 1)
    }

    @Test
    func dailyRecordNormalizesDateAndStoresMood() {
        let date = Date(timeIntervalSince1970: 1_712_345_678)
        let record = DailyRecord(
            date: date,
            quoteText: "text",
            quoteAuthor: "author",
            mood: .joyful
        )

        #expect(record.mood == DailyMood.joyful)
        #expect(Calendar(identifier: .gregorian).isDate(record.date, inSameDayAs: date))
    }

    @Test
    func edgeFunctionMockMatchesSupabaseContractShape() async throws {
        let service = EdgeFunctionService(mode: .mock)
        let response = try await service.fetchDailyOracle(
            request: OracleEdgeRequest(
                geo: .init(lng: 120.1551, lat: 30.2741),
                weather: .init(temperature: 20, condition: "多云", wind: 2),
                profile: .init(lang: "zh", region: "CN", pro: false),
                preferences: .init(
                    mood: DailyMood.reflective.rawValue,
                    moodHistory: ["calm"],
                    genreHistory: ["散文"]
                )
            )
        )

        #expect(response.quote?.text.isEmpty == false)
        #expect(response.quote?.mood == [DailyMood.reflective.rawValue])
        #expect(response.almanac.yi.hasPrefix("宜："))
        #expect(response.almanac.ji.hasPrefix("忌："))
        #expect(response.date.count == 10)
    }

    @Test
    @MainActor
    func storeRefreshPersistsMockPayloadIntoSwiftData() async throws {
        let container = try OracleModelContainer.makeContainer(inMemory: true)
        let context = ModelContext(container)
        let store = DailyOracleStore(
            edgeService: EdgeFunctionService(mode: .mock),
            weatherService: WeatherService(mode: .mock),
            locationService: LocationService(mode: .mock)
        )

        await store.refresh(using: context, config: nil)

        let records = try context.fetch(FetchDescriptor<DailyRecord>())
        let configs = try context.fetch(FetchDescriptor<UserConfig>())

        #expect(records.count == 1)
        #expect(records.first?.recommended.isEmpty == false)
        #expect(records.first?.avoided.isEmpty == false)
        #expect(records.first?.weatherSummary == "多云 21°C")
        #expect(configs.count == 1)
        #expect(configs.first?.cityName == "杭州")
        #expect(store.lastErrorMessage == nil)
    }
}
