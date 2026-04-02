//
//  daily_oracleApp.swift
//  daily-oracle
//
//  Created by Cain on 2026/4/2.
//

import SwiftUI
import SwiftData

@main
struct daily_oracleApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .modelContainer(OracleModelContainer.shared)
    }
}
