import Foundation
import SwiftData

enum OracleTab: String {
    case history
    case settings
}

enum OracleWidgetSize: String, CaseIterable, Identifiable {
    case large
    case medium
    case small

    var id: String { rawValue }

    var title: String {
        switch self {
        case .large: return "4 × 4"
        case .medium: return "4 × 2"
        case .small: return "2 × 2"
        }
    }
}

enum QuoteMood: String, CaseIterable, Codable, Identifiable {
    case calm
    case happy
    case sad
    case anxious
    case angry
    case resilient
    case romantic
    case philosophical

    var id: String { rawValue }

    var shortLabel: String {
        switch self {
        case .calm: return "静"
        case .happy: return "晴"
        case .sad: return "雨"
        case .anxious: return "紧"
        case .angry: return "火"
        case .resilient: return "韧"
        case .romantic: return "爱"
        case .philosophical: return "思"
        }
    }
}

enum OracleLocationState: Equatable {
    case idle
    case requesting
    case available(latitude: Double, longitude: Double)
    case denied
    case failed(String)

    var statusLabel: String {
        switch self {
        case .idle:
            return "未请求"
        case .requesting:
            return "定位中"
        case .available:
            return "已获取"
        case .denied:
            return "已拒绝"
        case let .failed(message):
            return message
        }
    }
}

struct OracleQuote: Codable, Identifiable, Equatable {
    let id: UUID
    let text: String
    let author: String?
    let work: String?
    let year: Int?
    let genre: String?
    let mood: [QuoteMood]
    let themes: [String]

    var attribution: String {
        if let author, let work {
            return "— \(author)《\(work)》"
        }

        if let author {
            return "— \(author)"
        }

        if let work {
            return "— 《\(work)》"
        }

        return "— 未知出处"
    }
}

struct OracleAlmanacSignals: Codable, Equatable {
    let weather: String?
    let temperature: String?
    let weatherIcon: String?

    enum CodingKeys: String, CodingKey {
        case weather
        case temperature
        case weatherIcon = "weather_icon"
    }

    init(weather: String? = nil, temperature: String? = nil, weatherIcon: String? = nil) {
        self.weather = weather
        self.temperature = temperature
        self.weatherIcon = weatherIcon
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        weather = try container.decodeIfPresent(String.self, forKey: .weather)
        weatherIcon = try container.decodeIfPresent(String.self, forKey: .weatherIcon)

        if let stringValue = try container.decodeIfPresent(String.self, forKey: .temperature) {
            temperature = stringValue
        } else if let intValue = try container.decodeIfPresent(Int.self, forKey: .temperature) {
            temperature = String(intValue)
        } else if let doubleValue = try container.decodeIfPresent(Double.self, forKey: .temperature) {
            temperature = String(Int(doubleValue))
        } else {
            temperature = nil
        }
    }
}

struct OracleAlmanacEntry: Codable, Identifiable, Equatable {
    let id: UUID
    let date: String
    let yi: String
    let ji: String
    let signals: OracleAlmanacSignals?
}

struct OracleDailyLog: Codable, Identifiable, Equatable {
    let id: UUID
    let date: String
    let mood: QuoteMood?
    let quoteID: UUID?
    let almanacID: UUID?

    enum CodingKeys: String, CodingKey {
        case id
        case date
        case mood
        case quoteID = "quote_id"
        case almanacID = "almanac_id"
    }
}

struct OracleAuthSession: Codable, Equatable {
    let accessToken: String
    let refreshToken: String?
    let tokenType: String?
    let expiresIn: Int?
    let user: OracleAuthUser

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case tokenType = "token_type"
        case expiresIn = "expires_in"
        case user
    }
}

struct OracleAuthUser: Codable, Equatable {
    let id: UUID
    let isAnonymous: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case isAnonymous = "is_anonymous"
    }
}

struct OracleUserProfile: Codable, Identifiable, Equatable {
    let userID: UUID
    let displayName: String
    let avatarSeed: Int
    let avatarEmoji: String?
    let createdAt: Date?
    let updatedAt: Date?

    var id: UUID { userID }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case displayName = "display_name"
        case avatarSeed = "avatar_seed"
        case avatarEmoji = "avatar_emoji"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct OracleUserProfileUpsert: Codable, Equatable {
    let userID: UUID
    let displayName: String
    let avatarSeed: Int
    let avatarEmoji: String?

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case displayName = "display_name"
        case avatarSeed = "avatar_seed"
        case avatarEmoji = "avatar_emoji"
    }
}

struct OracleFunctionQuoteResponse: Codable {
    let quote: OracleQuote
}

struct OracleFunctionAlmanacResponse: Codable {
    let almanac: OracleAlmanacEntry
    let weather: OracleAlmanacSignals?
}

struct OracleFunctionMoodResponse: Codable {
    let log: OracleDailyLog
}

struct OracleWidgetPayload: Codable, Equatable {
    let quote: OracleQuote?
    let almanac: OracleAlmanacEntry?
    let selectedMood: QuoteMood?
    let fetchedAt: Date
}

struct OracleDaySnapshot: Identifiable, Equatable {
    let date: Date
    let quote: OracleQuote?
    let almanac: OracleAlmanacEntry?

    var id: String { dayKey }

    var dayKey: String {
        Self.dayFormatter.string(from: date)
    }

    var weatherLine: String? {
        guard let signals = almanac?.signals else { return nil }
        let parts = [signals.weather, signals.temperature.map { "\($0)°C" }]
            .compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

struct CalendarDay: Identifiable, Equatable {
    let date: Date
    let isCurrentMonth: Bool

    var id: String { OracleDaySnapshot.dayFormatter.string(from: date) }
}

@Model
final class CachedDayRecord {
    @Attribute(.unique) var dayKey: String
    var date: Date
    var quoteID: String?
    var quoteText: String?
    var quoteAuthor: String?
    var quoteWork: String?
    var year: Int?
    var genre: String?
    var moodValues: [String]
    var themes: [String]
    var almanacID: String?
    var yi: String?
    var ji: String?
    var weather: String?
    var temperature: String?

    init(
        dayKey: String,
        date: Date,
        quoteID: String? = nil,
        quoteText: String? = nil,
        quoteAuthor: String? = nil,
        quoteWork: String? = nil,
        year: Int? = nil,
        genre: String? = nil,
        moodValues: [String] = [],
        themes: [String] = [],
        almanacID: String? = nil,
        yi: String? = nil,
        ji: String? = nil,
        weather: String? = nil,
        temperature: String? = nil
    ) {
        self.dayKey = dayKey
        self.date = date
        self.quoteID = quoteID
        self.quoteText = quoteText
        self.quoteAuthor = quoteAuthor
        self.quoteWork = quoteWork
        self.year = year
        self.genre = genre
        self.moodValues = moodValues
        self.themes = themes
        self.almanacID = almanacID
        self.yi = yi
        self.ji = ji
        self.weather = weather
        self.temperature = temperature
    }

    func toSnapshot() -> OracleDaySnapshot {
        let quote: OracleQuote? = if let quoteID,
                                     let uuid = UUID(uuidString: quoteID),
                                     let quoteText {
            OracleQuote(
                id: uuid,
                text: quoteText,
                author: quoteAuthor,
                work: quoteWork,
                year: year,
                genre: genre,
                mood: moodValues.compactMap(QuoteMood.init(rawValue:)),
                themes: themes
            )
        } else {
            nil
        }

        let almanac: OracleAlmanacEntry? = if let almanacID,
                                              let uuid = UUID(uuidString: almanacID),
                                              let yi,
                                              let ji {
            OracleAlmanacEntry(
                id: uuid,
                date: dayKey,
                yi: yi,
                ji: ji,
                signals: OracleAlmanacSignals(weather: weather, temperature: temperature)
            )
        } else {
            nil
        }

        return OracleDaySnapshot(date: date, quote: quote, almanac: almanac)
    }
}
