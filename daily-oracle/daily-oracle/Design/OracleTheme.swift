import SwiftUI

enum OracleAccentTheme: String, CaseIterable, Identifiable {
    case ink
    case indigo
    case verdant
    case rust
    case berry

    var id: String { rawValue }

    var accent: Color {
        switch self {
        case .ink: return Color(hex: 0x2C2C2A)
        case .indigo: return Color(hex: 0x534AB7)
        case .verdant: return Color(hex: 0x0F6E56)
        case .rust: return Color(hex: 0x993C1D)
        case .berry: return Color(hex: 0x993556)
        }
    }
}

enum OracleFontStyle: String, CaseIterable, Identifiable {
    case serif
    case sans

    var id: String { rawValue }

    var titleDesign: Font.Design {
        switch self {
        case .serif: return .serif
        case .sans: return .default
        }
    }

    var bodyDesign: Font.Design {
        switch self {
        case .serif: return .serif
        case .sans: return .default
        }
    }

    var label: String {
        switch self {
        case .serif: return "衬线体"
        case .sans: return "无衬线"
        }
    }
}

struct OraclePalette {
    let backgroundPrimary: Color
    let backgroundSecondary: Color
    let backgroundTertiary: Color
    let textPrimary: Color
    let textSecondary: Color
    let textTertiary: Color
    let borderTertiary: Color
    let borderSecondary: Color
    let borderPrimary: Color
    let yi: Color
    let ji: Color
    let accent: Color

    static func current(for colorScheme: ColorScheme, accent: OracleAccentTheme) -> OraclePalette {
        if colorScheme == .dark {
            return OraclePalette(
                backgroundPrimary: Color(hex: 0x1C1C1A),
                backgroundSecondary: Color(hex: 0x252522),
                backgroundTertiary: Color(hex: 0x2E2E2B),
                textPrimary: Color(hex: 0xF0EDE6),
                textSecondary: Color(hex: 0xB0ADA6),
                textTertiary: Color(hex: 0x6A6860),
                borderTertiary: Color.white.opacity(0.08),
                borderSecondary: Color.white.opacity(0.15),
                borderPrimary: Color.white.opacity(0.25),
                yi: Color(hex: 0x78AF47),
                ji: Color(hex: 0xD89B48),
                accent: accent.accent
            )
        }

        return OraclePalette(
            backgroundPrimary: .white,
            backgroundSecondary: Color(hex: 0xF5F4F0),
            backgroundTertiary: Color(hex: 0xEEECE7),
            textPrimary: Color(hex: 0x1A1A18),
            textSecondary: Color(hex: 0x4A4A46),
            textTertiary: Color(hex: 0x9A9890),
            borderTertiary: Color.black.opacity(0.10),
            borderSecondary: Color.black.opacity(0.18),
            borderPrimary: Color.black.opacity(0.30),
            yi: Color(hex: 0x3B6D11),
            ji: Color(hex: 0x854F0B),
            accent: accent.accent
        )
    }
}

extension Color {
    init(hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}
