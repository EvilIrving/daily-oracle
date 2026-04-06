//
//  OracleWidgetProvider.swift
//  daily-oracle
//
//  Widget Timeline Provider
//

import Foundation
import WidgetKit
import SwiftData

/// Widget 数据提供者
struct OracleWidgetProvider: TimelineProvider {
    typealias Entry = OracleWidgetEntry

    /// App Group 共享容器
    private var sharedContainer: ModelContainer? {
        try? OracleWidgetModelContainer.makeSharedContainer()
    }

    // MARK: - TimelineProvider

    func placeholder(in context: Context) -> Entry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        let entry = loadEntry(for: .now) ?? .preview
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let calendar = Calendar.oracle
        let today = calendar.startOfDay(for: .now)

        // 生成当天条目
        var entries: [Entry] = []

        if let todayEntry = loadEntry(for: today) {
            entries.append(todayEntry)
        } else {
            entries.append(.placeholder)
        }

        // 计算下一天的刷新时间（本地日界 + 5 分钟缓冲）
        guard let tomorrow = calendar.date(byAdding: .day, value: 1, to: today),
              let refreshDate = calendar.date(byAdding: .minute, value: 5, to: tomorrow) else {
            let timeline = Timeline(entries: entries, policy: .atEnd)
            completion(timeline)
            return
        }

        let timeline = Timeline(entries: entries, policy: .after(refreshDate))
        completion(timeline)
    }

    // MARK: - Data Loading

    private func loadEntry(for date: Date) -> Entry? {
        guard let container = sharedContainer else { return nil }

        let context = ModelContext(container)
        let calendar = Calendar.oracle
        let startOfDay = calendar.startOfDay(for: date)

        let descriptor = FetchDescriptor<DailyRecord>(
            predicate: #Predicate { record in
                record.date == startOfDay
            }
        )

        guard let record = try? context.fetch(descriptor).first else { return nil }

        return OracleWidgetEntry(
            date: record.date,
            quoteText: record.quoteText,
            quoteAuthor: record.quoteAuthor,
            quoteWork: record.quoteWork,
            recommended: record.recommended,
            avoided: record.avoided,
            moodRawValue: record.moodRawValue
        )
    }
}

// MARK: - Shared Model Container

enum OracleWidgetModelContainer {
    static func makeSharedContainer() throws -> ModelContainer {
        let schema = Schema([
            DailyRecord.self,
            Anniversary.self,
            UserConfig.self,
        ])

        // 使用 App Group 共享容器
        guard let groupURL = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: "group.cain.com.daily-oracle") else {
            throw OracleWidgetError.appGroupNotAvailable
        }

        let dbURL = groupURL.appendingPathComponent("daily_oracle.sqlite")

        let configuration = ModelConfiguration(
            schema: schema,
            url: dbURL,
            allowsSave: true
        )

        return try ModelContainer(for: schema, configurations: [configuration])
    }
}

enum OracleWidgetError: Error {
    case appGroupNotAvailable
}
