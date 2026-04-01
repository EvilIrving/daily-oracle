import SwiftUI
import SwiftData

@main
struct daily_oracleApp: App {
    private let sharedModelContainer: ModelContainer = {
        let schema = Schema([
            CachedDayRecord.self,
        ])

        let configuration = makeModelConfiguration(schema: schema)

        do {
            return try ModelContainer(for: schema, configurations: [configuration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(sharedModelContainer)
    }
}

private func makeModelConfiguration(schema: Schema) -> ModelConfiguration {
    guard
        let configuration = OracleConfiguration.load(),
        let appGroupID = configuration.appGroupID,
        let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID)
    else {
        return ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
    }

    let storeURL = containerURL.appendingPathComponent("oracle.store")
    return ModelConfiguration(schema: schema, url: storeURL)
}
