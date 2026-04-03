//
//  OracleModelContainer.swift
//  daily-oracle
//

import Foundation
import SwiftData

enum OracleModelContainer {
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
            allowsSave: true
        )

        return try ModelContainer(for: schema, configurations: [configuration])
    }
}
