import Foundation
import SwiftData
import Combine

@MainActor
final class OracleAppModel: ObservableObject {
    @Published private(set) var selectedTab: OracleTab = .history
    @Published private(set) var currentMonth: Date = .now
    @Published private(set) var snapshots: [OracleDaySnapshot] = []
    @Published private(set) var latestQuote: OracleQuote?
    @Published private(set) var selectedMood: QuoteMood?
    @Published private(set) var activeSession: OracleAuthSession?
    @Published private(set) var lastRefreshDate: Date?
    @Published private(set) var locationState: OracleLocationState = .idle
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    @Published var selectedDate: Date = .now

    private let locationManager = OracleLocationManager()

    func selectTab(_ tab: OracleTab) {
        selectedTab = tab
    }

    func shiftMonth(by delta: Int) {
        if let shifted = Calendar.current.date(byAdding: .month, value: delta, to: currentMonth) {
            currentMonth = shifted
        }
    }

    func load(modelContext: ModelContext) async {
        if isLoading { return }

        isLoading = true
        errorMessage = nil

        snapshots = loadCachedSnapshots(modelContext: modelContext)

        guard let configuration = OracleConfiguration.load() else {
            isLoading = false
            errorMessage = "先在 Scheme 环境变量或 Info.plist 里配置 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`。"
            return
        }

        let client = OracleAPIClient(configuration: configuration)
        let sharedStore = OracleSharedStore(configuration: configuration)

        do {
            if let payload = sharedStore.loadWidgetPayload() {
                latestQuote = payload.quote
                selectedMood = payload.selectedMood
                lastRefreshDate = payload.fetchedAt
            }

            let authSession = try await resolveSession(using: client, store: sharedStore)
            activeSession = authSession

            async let publicAlmanacTask = client.fetchRecentAlmanac()
            async let userLogsTask = client.fetchUserLogs(session: authSession)

            let publicAlmanacEntries = try await publicAlmanacTask
            let userLogs = try await userLogsTask

            var latestDailyQuote: OracleQuote?
            var todayAlmanacEntry = publicAlmanacEntries.first(where: { $0.date == todayKey })

            if sharedStore.lastFetchDayKey != todayKey || latestQuote == nil {
                locationState = .requesting
                let currentLocation = await locationManager.requestCurrentLocation()
                locationState = currentLocation

                if case let .available(latitude, longitude) = currentLocation {
                    async let quoteTask = client.fetchDailyQuote(session: authSession, mood: selectedMood)
                    async let almanacTask = client.generateAlmanac(
                        session: authSession,
                        latitude: latitude,
                        longitude: longitude
                    )

                    latestDailyQuote = try await quoteTask
                    let generatedAlmanac = try await almanacTask
                    todayAlmanacEntry = generatedAlmanac.almanac
                } else {
                    latestDailyQuote = try await client.fetchDailyQuote(session: authSession, mood: selectedMood)
                }
            } else {
                latestDailyQuote = latestQuote
            }

            latestQuote = latestDailyQuote ?? latestQuote
            snapshots = mergeSnapshots(
                quote: latestQuote,
                almanacEntries: publicAlmanacEntries,
                todayAlmanac: todayAlmanacEntry,
                userLogs: userLogs
            )

            if let latestQuote, let selectedMood {
                _ = try? await client.logMood(
                    session: authSession,
                    mood: selectedMood,
                    quoteID: latestQuote.id,
                    almanacID: todayAlmanacEntry?.id
                )
            }

            persistSnapshots(snapshots, modelContext: modelContext)

            if let latestQuote {
                let payload = OracleWidgetPayload(
                    quote: latestQuote,
                    almanac: todayAlmanacEntry,
                    selectedMood: selectedMood,
                    fetchedAt: .now
                )
                sharedStore.saveWidgetPayload(payload)
                lastRefreshDate = payload.fetchedAt
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func selectMood(_ mood: QuoteMood?, modelContext: ModelContext) async {
        selectedMood = mood
        await load(modelContext: modelContext)
    }

    var syncStatusText: String {
        if latestQuote == nil {
            return "未连通"
        }

        if let lastRefreshDate {
            return lastRefreshDate.formatted(.dateTime.hour().minute())
        }

        return "已读取"
    }

    var selectedSnapshot: OracleDaySnapshot? {
        let key = OracleDaySnapshot.dayFormatter.string(from: selectedDate)
        return snapshots.first(where: { $0.dayKey == key })
    }

    var calendarDays: [CalendarDay] {
        CalendarGridBuilder.makeDays(for: currentMonth)
    }

    private var todayKey: String {
        OracleDaySnapshot.dayFormatter.string(from: .now)
    }

    private func resolveSession(using client: OracleAPIClient, store: OracleSharedStore) async throws -> OracleAuthSession {
        if let cachedSession = store.loadSession() {
            return cachedSession
        }

        let authSession = try await client.signInAnonymously()
        store.saveSession(authSession)
        return authSession
    }

    private func mergeSnapshots(
        quote: OracleQuote?,
        almanacEntries: [OracleAlmanacEntry],
        todayAlmanac: OracleAlmanacEntry?,
        userLogs: [OracleDailyLog]
    ) -> [OracleDaySnapshot] {
        let calendar = Calendar(identifier: .gregorian)
        let almanacByDate = Dictionary(uniqueKeysWithValues: almanacEntries.map { ($0.date, $0) })
        let orderedDates = Array(Set(almanacEntries.map(\.date) + userLogs.map(\.date))).sorted(by: >)

        return orderedDates.compactMap { dayKey in
            let entry = (dayKey == todayKey ? todayAlmanac : nil) ?? almanacByDate[dayKey]
            guard let entry else { return nil }
            guard let date = OracleDaySnapshot.dayFormatter.date(from: entry.date) else { return nil }
            let log = userLogs.first(where: { $0.date == dayKey })
            let quoteForDay = dayKey == todayKey ? quote : (log?.quoteID == quote?.id ? quote : nil)
            return OracleDaySnapshot(date: calendar.startOfDay(for: date), quote: quoteForDay, almanac: entry)
        }
    }

    private func loadCachedSnapshots(modelContext: ModelContext) -> [OracleDaySnapshot] {
        let descriptor = FetchDescriptor<CachedDayRecord>(sortBy: [SortDescriptor(\.date, order: .reverse)])
        let records = (try? modelContext.fetch(descriptor)) ?? []
        let mapped = records.map { $0.toSnapshot() }
        if latestQuote == nil {
            latestQuote = mapped.first?.quote
        }
        return mapped
    }

    private func persistSnapshots(_ snapshots: [OracleDaySnapshot], modelContext: ModelContext) {
        let descriptor = FetchDescriptor<CachedDayRecord>()
        let existingRecords = (try? modelContext.fetch(descriptor)) ?? []
        let recordsByKey = Dictionary(uniqueKeysWithValues: existingRecords.map { ($0.dayKey, $0) })

        for snapshot in snapshots {
            let record = recordsByKey[snapshot.dayKey] ?? CachedDayRecord(dayKey: snapshot.dayKey, date: snapshot.date)
            record.date = snapshot.date
            record.quoteID = snapshot.quote?.id.uuidString
            record.quoteText = snapshot.quote?.text
            record.quoteAuthor = snapshot.quote?.author
            record.quoteWork = snapshot.quote?.work
            record.year = snapshot.quote?.year
            record.genre = snapshot.quote?.genre
            record.moodValues = snapshot.quote?.mood.map(\.rawValue) ?? []
            record.themes = snapshot.quote?.themes ?? []
            record.almanacID = snapshot.almanac?.id.uuidString
            record.yi = snapshot.almanac?.yi
            record.ji = snapshot.almanac?.ji
            record.weather = snapshot.almanac?.signals?.weather
            record.temperature = snapshot.almanac?.signals?.temperature

            if recordsByKey[snapshot.dayKey] == nil {
                modelContext.insert(record)
            }
        }

        try? modelContext.save()
    }
}

enum CalendarGridBuilder {
    static func makeDays(for month: Date, calendar: Calendar = Calendar(identifier: .gregorian)) -> [CalendarDay] {
        guard
            let monthInterval = calendar.dateInterval(of: .month, for: month),
            let firstWeekInterval = calendar.dateInterval(of: .weekOfMonth, for: monthInterval.start),
            let lastWeekAnchor = calendar.date(byAdding: DateComponents(day: -1), to: monthInterval.end),
            let lastWeekInterval = calendar.dateInterval(of: .weekOfMonth, for: lastWeekAnchor)
        else {
            return []
        }

        var days: [CalendarDay] = []
        var cursor = firstWeekInterval.start

        while cursor < lastWeekInterval.end {
            let isCurrentMonth = calendar.isDate(cursor, equalTo: month, toGranularity: .month)
            days.append(CalendarDay(date: cursor, isCurrentMonth: isCurrentMonth))
            guard let next = calendar.date(byAdding: .day, value: 1, to: cursor) else { break }
            cursor = next
        }

        return days
    }
}
