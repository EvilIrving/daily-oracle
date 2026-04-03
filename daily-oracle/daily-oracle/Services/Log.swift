//
//  Log.swift
//  daily-oracle
//

import OSLog

enum Log {
    static let network = Logger(subsystem: Bundle.main.bundleIdentifier ?? "daily-oracle", category: "Network")
    static let location = Logger(subsystem: Bundle.main.bundleIdentifier ?? "daily-oracle", category: "Location")
    static let weather = Logger(subsystem: Bundle.main.bundleIdentifier ?? "daily-oracle", category: "Weather")
    static let store = Logger(subsystem: Bundle.main.bundleIdentifier ?? "daily-oracle", category: "Store")
    static let data = Logger(subsystem: Bundle.main.bundleIdentifier ?? "daily-oracle", category: "Data")
}
