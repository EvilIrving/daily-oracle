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
}
