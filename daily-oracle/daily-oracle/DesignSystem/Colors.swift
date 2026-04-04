import SwiftUI

enum AppColors {
    static let backgroundPrimary = Color("backgroundPrimary")
    static let backgroundSecondary = Color("backgroundSecondary")
    static let backgroundTertiary = Color("backgroundTertiary")

    static let textPrimary = Color("textPrimary")
    static let textSecondary = Color("textSecondary")
    static let textTertiary = Color("textTertiary")

    static let borderPrimary = Color("borderPrimary")
    static let borderSecondary = Color("borderSecondary")
    static let borderTertiary = Color("borderTertiary")

    static let yi = Color("yi")
    static let ji = Color("ji")

    static func mood(_ mood: QuoteMood?) -> Color {
        guard let mood else { return .clear }
        return Color(mood.rawValue)
    }

    static func moodFill(_ quoteMood: QuoteMood?, opacity: Double = 1) -> Color {
        mood(quoteMood).opacity(opacity)
    }
}
