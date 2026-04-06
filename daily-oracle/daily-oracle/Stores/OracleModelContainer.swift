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

    static let appGroupID = "group.cain.com.daily-oracle"

    static func makeContainer(inMemory: Bool = false) throws -> ModelContainer {
        let schema = Schema([
            DailyRecord.self,
            Anniversary.self,
            UserConfig.self,
        ])

        let configuration: ModelConfiguration

        if inMemory {
            configuration = ModelConfiguration(
                schema: schema,
                isStoredInMemoryOnly: true,
                allowsSave: true
            )
        } else {
            // 使用 App Group 共享容器，供 Widget 读取
            guard let groupURL = FileManager.default
                .containerURL(forSecurityApplicationGroupIdentifier: appGroupID) else {
                throw OracleContainerError.appGroupNotAvailable
            }

            let dbURL = groupURL.appendingPathComponent("daily_oracle.sqlite")

            configuration = ModelConfiguration(
                schema: schema,
                url: dbURL,
                allowsSave: true
            )
        }

        return try ModelContainer(for: schema, configurations: [configuration])
    }
}

enum OracleContainerError: Error {
    case appGroupNotAvailable
}
