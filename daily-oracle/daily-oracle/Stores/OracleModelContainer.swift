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

    static func makeContainer(inMemory: Bool = false) throws -> ModelContainer {
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

        return try ModelContainer(for: schema, configurations: [configuration])
    }
}
