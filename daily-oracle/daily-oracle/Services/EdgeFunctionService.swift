//
//  EdgeFunctionService.swift
//  daily-oracle
//

import Foundation

protocol EdgeFunctionServicing: Sendable {
    func fetchDailyOracle(request: OracleEdgeRequest) async throws -> OracleEdgeResponse
}

struct EdgeFunctionService: EdgeFunctionServicing {
    enum Mode: Sendable {
        case mock
        case live(baseURL: URL, publishableKey: String)
    }

    private let mode: Mode
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(
        mode: Mode = .mock,
        session: URLSession = .shared,
        decoder: JSONDecoder = JSONDecoder(),
        encoder: JSONEncoder = JSONEncoder()
    ) {
        self.mode = mode
        self.session = session
        self.decoder = decoder
        self.encoder = encoder
    }

    func fetchDailyOracle(request: OracleEdgeRequest) async throws -> OracleEdgeResponse {
        switch mode {
        case .mock:
            return Self.mockResponse(request: request)
        case let .live(baseURL, publishableKey):
            return try await fetchLiveDailyOracle(
                request: request,
                baseURL: baseURL,
                publishableKey: publishableKey
            )
        }
    }

    private func fetchLiveDailyOracle(
        request: OracleEdgeRequest,
        baseURL: URL,
        publishableKey: String
    ) async throws -> OracleEdgeResponse {
        var url = baseURL
        url.append(path: "functions/v1/daily-oracle")

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue(publishableKey, forHTTPHeaderField: "apikey")
        urlRequest.setValue("Bearer \(publishableKey)", forHTTPHeaderField: "Authorization")
        urlRequest.httpBody = try encoder.encode(request)

        let (data, response) = try await session.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw EdgeFunctionError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "unknown error"
            throw EdgeFunctionError.requestFailed(statusCode: httpResponse.statusCode, message: message)
        }

        return try decoder.decode(OracleEdgeResponse.self, from: data)
    }

    private static func mockResponse(request: OracleEdgeRequest) -> OracleEdgeResponse {
        let preferredMood = request.preferences.mood ?? DailyMood.calm.rawValue
        let condition = request.weather.condition
        let city = request.geo.lat == 0 && request.geo.lng == 0 ? nil : "本地天气"
        let note = city.map { "\($0) \(condition)" } ?? condition

        return OracleEdgeResponse(
            quote: .init(
                id: "mock-quote-\(preferredMood)",
                text: "风把今天吹得很薄，适合留一点空白给自己。",
                author: "每日神谕",
                work: "Mock Payload",
                year: Calendar.oracle.component(.year, from: .now),
                mood: [preferredMood],
                themes: [condition]
            ),
            almanac: .init(
                yi: "宜：在\(note)里走一小段路",
                ji: "忌：把所有空档都拿去补昨天的焦虑"
            ),
            date: ISO8601DateFormatter().string(from: .now).prefix(10).description
        )
    }
}

enum EdgeFunctionError: LocalizedError {
    case invalidResponse
    case requestFailed(statusCode: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "daily-oracle 返回了无效响应。"
        case let .requestFailed(statusCode, message):
            return "daily-oracle 请求失败（\(statusCode)）：\(message)"
        }
    }
}

private extension Calendar {
    static let oracle = Calendar(identifier: .gregorian)
}
