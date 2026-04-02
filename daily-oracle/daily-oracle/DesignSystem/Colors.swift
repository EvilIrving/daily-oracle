import SwiftUI

extension Color {
    static let yi = Color(hex: 0x3B6D11)
    static let ji = Color(hex: 0x854F0B)
}

enum Mood: String, CaseIterable, Identifiable {
    case calm, happy, sad, anxious, angry, resilient, romantic, philosophical

    var id: String { rawValue }

    var color: Color {
        switch self {
        case .calm:          Color(hex: 0x9F8FD4)
        case .happy:         Color(hex: 0xEFA827)
        case .sad:           Color(hex: 0x6DBFA0)
        case .anxious:       Color(hex: 0xD4537E)
        case .angry:         Color(hex: 0xE24B4A)
        case .resilient:     Color(hex: 0x4A8C6F)
        case .romantic:      Color(hex: 0xC46B8F)
        case .philosophical: Color(hex: 0x5B7FA5)
        }
    }

    var icon: String {
        switch self {
        case .calm:          "moon.stars"
        case .happy:         "sun.max"
        case .sad:           "cloud.rain"
        case .anxious:       "wind"
        case .angry:         "flame"
        case .resilient:     "leaf"
        case .romantic:      "heart"
        case .philosophical: "sparkles"
        }
    }
}

extension Color {
    init(hex: UInt, opacity: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}
