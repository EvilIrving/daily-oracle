//
//  Item.swift
//  daily-oracle
//
//  Created by Cain on 2026/3/31.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
