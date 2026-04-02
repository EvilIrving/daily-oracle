import SwiftUI

extension Font {
    static let quoteDisplay = Font.system(size: 24, weight: .regular, design: .serif)
    static let quoteWidget = Font.system(size: 11, weight: .regular, design: .serif)
    static let quoteWidgetSmall = Font.system(size: 9.5, weight: .regular, design: .serif)

    static let navTitle = Font.system(size: 20, weight: .medium)
    static let calMonth = Font.system(size: 13, weight: .medium)
    static let sectionLabel = Font.system(size: 10, weight: .regular).tracking(0.4)

    static let settingLabel = Font.system(size: 13, weight: .regular)
    static let settingValue = Font.system(size: 12, weight: .regular)

    static let detailDate = Font.system(size: 10, weight: .regular)
    static let detailQuote = Font.system(size: 12, weight: .regular, design: .serif)
    static let detailAuthor = Font.system(size: 10, weight: .regular)

    static let tabLabel = Font.system(size: 10, weight: .regular)
    static let tagLabel = Font.system(size: 11, weight: .regular)
}
