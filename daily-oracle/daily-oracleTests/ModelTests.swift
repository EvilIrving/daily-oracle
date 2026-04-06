import Foundation
import Testing
@testable import daily_oracle

struct ModelTests {
    @Test
    func dailyRecordMoodDefaultsToNilWhenOmitted() {
        let record = DailyRecord(
            date: .now,
            quoteText: "t",
            quoteAuthor: "a"
        )

        #expect(record.mood == nil)
        #expect(record.moodRawValue == nil)
    }

    @Test
    func dailyRecordNormalizesDateAndStoresMood() {
        let date = Date(timeIntervalSince1970: 1_712_345_678)
        let record = DailyRecord(
            date: date,
            quoteText: "text",
            quoteAuthor: "author",
            mood: .happy
        )

        #expect(record.mood == .some(.happy))
        #expect(Calendar.oracle.isDate(record.date, inSameDayAs: date))
    }

    @Test
    func dailyRecordMoodSetterClearsRawValueAndRefreshesTimestamp() {
        let originalUpdatedAt = Date(timeIntervalSince1970: 1_700_000_000)
        let record = DailyRecord(
            date: .now,
            quoteText: "text",
            quoteAuthor: "author",
            mood: .calm,
            updatedAt: originalUpdatedAt
        )

        record.mood = nil

        #expect(record.mood == nil)
        #expect(record.moodRawValue == nil)
        #expect(record.updatedAt >= originalUpdatedAt)
    }

    @Test
    func userConfigProvidesStableDefaults() {
        let config = UserConfig()

        #expect(config.preferredFontName == "SourceHanSerifCN-Regular")
        #expect(config.selectedTheme == "system")
        #expect(config.preferredSourceLanguages == ["zh"])
    }
}
