import Testing
import Foundation
@testable import daily_oracle

@MainActor
struct daily_oracleTests {

    @Test func calendarGridCoversWholeMonth() async throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let month = calendar.date(from: DateComponents(year: 2026, month: 3, day: 1))!

        let days = CalendarGridBuilder.makeDays(for: month, calendar: calendar)

        #expect(days.count == 35)
        #expect(days.contains(where: { calendar.component(.day, from: $0.date) == 1 && $0.isCurrentMonth }))
        #expect(days.contains(where: { calendar.component(.day, from: $0.date) == 31 && $0.isCurrentMonth }))
    }

    @Test func snapshotDayKeyUsesStableFormat() async throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let date = calendar.date(from: DateComponents(year: 2026, month: 4, day: 1))!
        let snapshot = OracleDaySnapshot(date: date, quote: nil, almanac: nil)

        #expect(snapshot.dayKey == "2026-04-01")
    }

}
