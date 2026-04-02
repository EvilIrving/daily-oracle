//
//  OracleModelContainer.swift
//  daily-oracle
//

import Foundation
import SwiftData

enum OracleModelContainer {
    static let appGroupIdentifier = "group.cain.com.daily-oracle"
    static let cloudKitContainerIdentifier = "iCloud.cain.com.daily-oracle"

    static let shared: ModelContainer = {
        try! makeContainer()
    }()

    static func makeContainer(
        inMemory: Bool = false,
        seedWithSamples: Bool = false
    ) throws -> ModelContainer {
        let schema = Schema([
            DailyRecord.self,
            Anniversary.self,
            UserConfig.self,
        ])

        let configuration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: inMemory,
            allowsSave: true,
            groupContainer: inMemory ? .none : .identifier(appGroupIdentifier),
            cloudKitDatabase: .automatic
        )

        let container = try ModelContainer(for: schema, configurations: [configuration])

        if seedWithSamples {
            try seedPreviewDataIfNeeded(in: container)
        }

        return container
    }

    @MainActor
    static func previewContainer() -> ModelContainer {
        let container = try! makeContainer(inMemory: true, seedWithSamples: true)
        return container
    }

    private static func seedPreviewDataIfNeeded(in container: ModelContainer) throws {
        let context = ModelContext(container)
        let fetchDescriptor = FetchDescriptor<UserConfig>()
        let hasConfig = try context.fetch(fetchDescriptor).isEmpty == false

        guard hasConfig == false else { return }

        context.insert(
            UserConfig(
                selectedTheme: "mist",
                preferredSourceLanguages: ["zh", "translated"],
                preferredGenres: ["散文", "小说"],
                cityName: "杭州"
            )
        )

        context.insert(
            Anniversary(
                title: "第一次发布",
                date: .now.addingTimeInterval(86_400 * 12),
                note: "用于验证 Widget 共享数据"
            )
        )

        context.insert(
            DailyRecord(
                date: .now,
                quoteText: "春天不是季节，是一个人从风里重新认出自己。",
                quoteAuthor: "木心",
                quoteWork: "云雀叫了一整天",
                recommended: ["出门", "晒太阳", "整理书桌"],
                avoided: ["熬夜", "拖延"],
                mood: .reflective,
                weatherSummary: "多云 18°C"
            )
        )

        try context.save()
    }
}
