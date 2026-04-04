import Foundation
import SwiftData
import Testing
@testable import daily_oracle

@MainActor
struct StoreTests {
    @Test
    func refreshCreatesRecordAndConfigWhenMissing() async throws {
        let modelContext = try TestSupport.makeModelContext()
        let edgeService = EdgeFunctionServiceSpy(result: .success(.fixture()))
        let store = DailyOracleStore(edgeService: edgeService)

        await store.refresh(using: modelContext, config: nil)

        #expect(store.isLoading == false)
        #expect(store.lastErrorMessage == nil)
        #expect(edgeService.receivedRequests.count == 1)

        let request = try #require(edgeService.receivedRequests.first)
        #expect(request.geo == nil)
        #expect(request.weather == nil)

        let records = try modelContext.fetch(FetchDescriptor<DailyRecord>())
        #expect(records.count == 1)

        let record = try #require(records.first)
        #expect(record.quoteText == "Stay hungry, stay foolish.")
        #expect(record.quoteAuthor == "Steve Jobs")
        #expect(record.quoteWork == "Stanford Commencement")
        #expect(record.recommended == "读书")
        #expect(record.avoided == "拖延")
        #expect(Calendar.oracle.isDate(record.date, inSameDayAs: DateComponents(calendar: .oracle, year: 2026, month: 4, day: 3).date!))

        let configs = try modelContext.fetch(FetchDescriptor<UserConfig>())
        #expect(configs.count == 1)

        let config = try #require(configs.first)
        #expect(config.lastSyncedAt != nil)
        #expect(store.lastResponseDate == record.date)
    }

    @Test
    func refreshUpdatesExistingRecordAndConfigForSameOracleDate() async throws {
        let modelContext = try TestSupport.makeModelContext()
        let existingDate = DateComponents(calendar: .oracle, year: 2026, month: 4, day: 3).date!
        let existingRecord = DailyRecord(
            date: existingDate,
            quoteText: "old text",
            quoteAuthor: "old author",
            quoteWork: "old work",
            recommended: "old yi",
            avoided: "old ji",
            updatedAt: Date(timeIntervalSince1970: 1_700_000_000)
        )
        let config = UserConfig(
            lastSyncedAt: Date(timeIntervalSince1970: 1_700_000_100)
        )
        modelContext.insert(existingRecord)
        modelContext.insert(config)
        try modelContext.save()

        let edgeService = EdgeFunctionServiceSpy(result: .success(.fixture()))
        let store = DailyOracleStore(edgeService: edgeService)

        await store.refresh(using: modelContext, config: config)

        let records = try modelContext.fetch(FetchDescriptor<DailyRecord>())
        #expect(records.count == 1)

        let updatedRecord = try #require(records.first)
        #expect(updatedRecord.id == existingRecord.id)
        #expect(updatedRecord.quoteText == "Stay hungry, stay foolish.")
        #expect(updatedRecord.quoteAuthor == "Steve Jobs")
        #expect(updatedRecord.quoteWork == "Stanford Commencement")
        #expect(updatedRecord.recommended == "读书")
        #expect(updatedRecord.avoided == "拖延")
        #expect(updatedRecord.updatedAt > Date(timeIntervalSince1970: 1_700_000_000))

        #expect(config.lastSyncedAt != nil)
    }

    @Test
    func refreshSurfacesErrorsWithoutWritingState() async throws {
        let modelContext = try TestSupport.makeModelContext()
        let edgeService = EdgeFunctionServiceSpy(result: .failure(StubError.failed("edge failed")))
        let store = DailyOracleStore(edgeService: edgeService)

        await store.refresh(using: modelContext, config: nil)

        #expect(store.isLoading == false)
        #expect(store.lastErrorMessage == "edge failed")
        #expect(store.lastResponseDate == nil)

        let records = try modelContext.fetch(FetchDescriptor<DailyRecord>())
        let configs = try modelContext.fetch(FetchDescriptor<UserConfig>())
        #expect(records.isEmpty)
        #expect(configs.isEmpty)
    }
}

private extension OracleEdgeResponse {
    static func fixture() -> Self {
        .init(
            quote: .init(
                id: "quote-1",
                text: "Stay hungry, stay foolish.",
                author: "Steve Jobs",
                work: "Stanford Commencement",
                year: 2005
            ),
            almanac: .init(
                yi: "读书",
                ji: "拖延"
            ),
            date: "2026-04-03"
        )
    }
}
