//
//  OracleWidgetBundle.swift
//  daily-oracle
//
//  WidgetKit Extension Entry Point
//

import WidgetKit
import SwiftUI

@main
struct OracleWidgetBundle: WidgetBundle {
    var body: some Widget {
        OracleWidgetSmall()
        OracleWidgetMedium()
        OracleWidgetLarge()
    }
}
