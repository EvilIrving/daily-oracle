import Foundation

struct OracleConfiguration {
    let supabaseURL: URL
    let anonKey: String
    let functionsURL: URL
    let appGroupID: String?

    static func load(bundle: Bundle = .main, processInfo: ProcessInfo = .processInfo) -> OracleConfiguration? {
        let env = processInfo.environment

        let urlString =
            env["SUPABASE_URL"] ??
            bundle.object(forInfoDictionaryKey: "SUPABASE_URL") as? String

        let anonKey =
            env["SUPABASE_ANON_KEY"] ??
            bundle.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String

        let functionsURLString =
            env["SUPABASE_FUNCTIONS_URL"] ??
            bundle.object(forInfoDictionaryKey: "SUPABASE_FUNCTIONS_URL") as? String

        let appGroupID =
            env["APP_GROUP_ID"] ??
            bundle.object(forInfoDictionaryKey: "APP_GROUP_ID") as? String

        guard
            let urlString,
            let anonKey,
            let url = URL(string: urlString),
            !anonKey.isEmpty
        else {
            return nil
        }

        let functionsURL = URL(string: functionsURLString ?? "\(url.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")))/functions/v1")

        guard let functionsURL else {
            return nil
        }

        return OracleConfiguration(
            supabaseURL: url,
            anonKey: anonKey,
            functionsURL: functionsURL,
            appGroupID: appGroupID
        )
    }
}

struct OracleAPIClient {
    private let configuration: OracleConfiguration
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(configuration: OracleConfiguration, session: URLSession = .shared) {
        self.configuration = configuration
        self.session = session
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    func signInAnonymously() async throws -> OracleAuthSession {
        let url = try authURL(path: "signup")
        let body = try encoder.encode(OracleAnonymousSignInRequest(data: [:]))
        return try await perform(requestURL: url, method: "POST", body: body, bearerToken: nil)
    }

    func signUp(email: String, password: String) async throws -> OracleAuthSession {
        let url = try authURL(path: "signup")
        let body = try encoder.encode(OracleEmailPasswordAuthRequest(email: email, password: password))
        return try await perform(requestURL: url, method: "POST", body: body, bearerToken: nil)
    }

    func signIn(email: String, password: String) async throws -> OracleAuthSession {
        var components = URLComponents(url: configuration.supabaseURL, resolvingAgainstBaseURL: false)
        components?.path = "/auth/v1/token"
        components?.queryItems = [URLQueryItem(name: "grant_type", value: "password")]

        guard let url = components?.url else {
            throw OracleServiceError.invalidConfiguration
        }

        let body = try encoder.encode(OracleEmailPasswordAuthRequest(email: email, password: password))
        return try await perform(requestURL: url, method: "POST", body: body, bearerToken: nil)
    }

    /// Upgrade a guest (anonymous) session by attaching email+password to the current user.
    /// This keeps `auth.uid()` stable so user-owned rows (logs, anniversaries) don't get orphaned.
    func upgradeAnonymousSession(currentSession: OracleAuthSession, email: String, password: String) async throws {
        let url = try authURL(path: "user")
        let body = try encoder.encode(OracleUpgradeAnonymousRequest(email: email, password: password))
        let _: OracleAuthUser = try await perform(requestURL: url, method: "PUT", body: body, bearerToken: currentSession.accessToken)
    }

    func fetchDailyQuote(session authSession: OracleAuthSession, mood: QuoteMood?) async throws -> OracleQuote {
        var queryItems: [URLQueryItem] = []
        if let mood {
            queryItems.append(URLQueryItem(name: "mood", value: mood.rawValue))
        }

        let url = try functionURL(path: "daily-quote", queryItems: queryItems)
        let response: OracleFunctionQuoteResponse = try await perform(
            requestURL: url,
            method: "GET",
            bearerToken: authSession.accessToken
        )
        return response.quote
    }

    func generateAlmanac(session authSession: OracleAuthSession, latitude: Double, longitude: Double) async throws -> OracleFunctionAlmanacResponse {
        let url = try functionURL(path: "generate-almanac", queryItems: [])
        let body = try encoder.encode(["lat": latitude, "lon": longitude])

        return try await perform(
            requestURL: url,
            method: "POST",
            body: body,
            bearerToken: authSession.accessToken
        )
    }

    func logMood(
        session authSession: OracleAuthSession,
        mood: QuoteMood,
        quoteID: UUID?,
        almanacID: UUID?
    ) async throws -> OracleDailyLog {
        let url = try functionURL(path: "log-mood", queryItems: [])
        let payload = OracleMoodLogRequest(mood: mood, quoteId: quoteID, almanacId: almanacID)
        let body = try encoder.encode(payload)
        let response: OracleFunctionMoodResponse = try await perform(
            requestURL: url,
            method: "POST",
            body: body,
            bearerToken: authSession.accessToken
        )
        return response.log
    }

    func fetchUserLogs(session authSession: OracleAuthSession, limit: Int = 90) async throws -> [OracleDailyLog] {
        let url = try restURL(
            path: "user_daily_logs",
            queryItems: [
                URLQueryItem(name: "select", value: "id,date,mood,quote_id,almanac_id"),
                URLQueryItem(name: "order", value: "date.desc"),
                URLQueryItem(name: "limit", value: String(limit)),
            ]
        )

        return try await perform(
            requestURL: url,
            method: "GET",
            bearerToken: authSession.accessToken
        )
    }

    func fetchRecentAlmanac(limit: Int = 45) async throws -> [OracleAlmanacEntry] {
        let url = try restURL(
            path: "almanac_entries",
            queryItems: [
                URLQueryItem(name: "select", value: "id,date,yi,ji,signals"),
                URLQueryItem(name: "order", value: "date.desc"),
                URLQueryItem(name: "limit", value: String(limit)),
            ]
        )

        return try await perform(requestURL: url, method: "GET", bearerToken: nil)
    }

    func fetchUserProfile(session authSession: OracleAuthSession) async throws -> OracleUserProfile? {
        let url = try restURL(
            path: "user_profiles",
            queryItems: [
                URLQueryItem(name: "select", value: "user_id,display_name,avatar_seed,avatar_emoji,created_at,updated_at"),
                URLQueryItem(name: "limit", value: "1"),
            ]
        )

        let profiles: [OracleUserProfile] = try await perform(
            requestURL: url,
            method: "GET",
            bearerToken: authSession.accessToken
        )
        return profiles.first
    }

    func upsertUserProfile(session authSession: OracleAuthSession, profile: OracleUserProfileUpsert) async throws -> OracleUserProfile {
        let url = try restURL(
            path: "user_profiles",
            queryItems: [
                URLQueryItem(name: "on_conflict", value: "user_id"),
                URLQueryItem(name: "select", value: "user_id,display_name,avatar_seed,avatar_emoji,created_at,updated_at"),
            ]
        )

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = try encoder.encode(profile)
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(authSession.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        request.setValue("return=representation", forHTTPHeaderField: "Prefer")

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw OracleServiceError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw OracleServiceError.httpError(statusCode: httpResponse.statusCode, message: message)
        }

        let created: [OracleUserProfile] = try decoder.decode([OracleUserProfile].self, from: data)
        guard let first = created.first else {
            throw OracleServiceError.invalidResponse
        }
        return first
    }

    private func authURL(path: String) throws -> URL {
        var components = URLComponents(url: configuration.supabaseURL, resolvingAgainstBaseURL: false)
        components?.path = "/auth/v1/\(path)"

        guard let url = components?.url else {
            throw OracleServiceError.invalidConfiguration
        }

        return url
    }

    private func restURL(path: String, queryItems: [URLQueryItem]) throws -> URL {
        var components = URLComponents(url: configuration.supabaseURL, resolvingAgainstBaseURL: false)
        components?.path = "/rest/v1/\(path)"
        components?.queryItems = queryItems

        guard let url = components?.url else {
            throw OracleServiceError.invalidConfiguration
        }

        return url
    }

    private func functionURL(path: String, queryItems: [URLQueryItem]) throws -> URL {
        var components = URLComponents(url: configuration.functionsURL, resolvingAgainstBaseURL: false)
        let basePath = configuration.functionsURL.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        components?.path = "/\(basePath)/\(path)"
        components?.queryItems = queryItems.isEmpty ? nil : queryItems

        guard let url = components?.url else {
            throw OracleServiceError.invalidConfiguration
        }

        return url
    }

    private func perform<Response: Decodable>(
        requestURL: URL,
        method: String,
        body: Data? = nil,
        bearerToken: String?
    ) async throws -> Response {
        var request = URLRequest(url: requestURL)
        request.httpMethod = method
        request.httpBody = body
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        if let bearerToken {
            request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw OracleServiceError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw OracleServiceError.httpError(statusCode: httpResponse.statusCode, message: message)
        }

        return try decoder.decode(Response.self, from: data)
    }
}

private struct OracleMoodLogRequest: Codable {
    let mood: QuoteMood
    let quoteId: UUID?
    let almanacId: UUID?
}

private struct OracleAnonymousSignInRequest: Codable {
    let data: [String: String]
}

private struct OracleEmailPasswordAuthRequest: Codable {
    let email: String
    let password: String
}

private struct OracleUpgradeAnonymousRequest: Codable {
    let email: String
    let password: String
}

enum OracleServiceError: LocalizedError {
    case invalidConfiguration
    case invalidResponse
    case httpError(statusCode: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidConfiguration:
            return "缺少 Supabase 配置"
        case .invalidResponse:
            return "服务端返回了无效响应"
        case let .httpError(statusCode, message):
            return "请求失败（\(statusCode)）：\(message)"
        }
    }
}
