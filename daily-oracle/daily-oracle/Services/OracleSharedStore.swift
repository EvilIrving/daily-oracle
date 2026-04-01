import Foundation

struct OracleSharedStore {
    private enum Keys {
        static let authSession = "oracle.auth.session"
        static let widgetPayload = "oracle.widget.payload"
        static let lastFetchDayKey = "oracle.lastFetchDayKey"
    }

    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(configuration: OracleConfiguration) {
        if let appGroupID = configuration.appGroupID,
           let sharedDefaults = UserDefaults(suiteName: appGroupID) {
            defaults = sharedDefaults
        } else {
            defaults = .standard
        }
    }

    func loadSession() -> OracleAuthSession? {
        decode(OracleAuthSession.self, forKey: Keys.authSession)
    }

    func saveSession(_ session: OracleAuthSession) {
        encode(session, forKey: Keys.authSession)
    }

    func saveWidgetPayload(_ payload: OracleWidgetPayload) {
        encode(payload, forKey: Keys.widgetPayload)
        defaults.set(OracleDaySnapshot.dayFormatter.string(from: payload.fetchedAt), forKey: Keys.lastFetchDayKey)
    }

    func loadWidgetPayload() -> OracleWidgetPayload? {
        decode(OracleWidgetPayload.self, forKey: Keys.widgetPayload)
    }

    var lastFetchDayKey: String? {
        defaults.string(forKey: Keys.lastFetchDayKey)
    }

    private func encode<T: Encodable>(_ value: T, forKey key: String) {
        guard let data = try? encoder.encode(value) else { return }
        defaults.set(data, forKey: key)
    }

    private func decode<T: Decodable>(_ type: T.Type, forKey key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? decoder.decode(type, from: data)
    }
}

