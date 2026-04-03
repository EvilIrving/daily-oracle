//
//  EdgeFunctionService.swift
//  daily-oracle
//

import Foundation
import OSLog

protocol EdgeFunctionServicing: Sendable {
    func fetchDailyOracle(request: OracleEdgeRequest) async throws -> OracleEdgeResponse
}

struct EdgeFunctionService: EdgeFunctionServicing {
    private let baseURL: URL
    private let publishableKey: String
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(
        baseURL: URL,
        publishableKey: String,
        session: URLSession = .shared,
        decoder: JSONDecoder = JSONDecoder(),
        encoder: JSONEncoder = JSONEncoder()
    ) {
        self.baseURL = baseURL
        self.publishableKey = publishableKey
        self.session = session
        self.decoder = decoder
        self.encoder = encoder
    }

    func fetchDailyOracle(request: OracleEdgeRequest) async throws -> OracleEdgeResponse {
        var url = baseURL
        url.append(path: "functions/v1/daily-oracle")

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue(publishableKey, forHTTPHeaderField: "apikey")
        urlRequest.setValue("Bearer \(publishableKey)", forHTTPHeaderField: "Authorization")
        urlRequest.httpBody = try encoder.encode(request)

        Log.network.info("POST \(url.absoluteString, privacy: .public)")

        let (data, response) = try await session.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse else {
            Log.network.error("Invalid response (not HTTPURLResponse)")
            throw EdgeFunctionError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "unknown error"
            Log.network.error("HTTP \(httpResponse.statusCode) — \(message, privacy: .public)")
            throw EdgeFunctionError.requestFailed(statusCode: httpResponse.statusCode, message: message)
        }

        Log.network.info("HTTP \(httpResponse.statusCode) — \(data.count) bytes")

        do {
            let decoded = try decoder.decode(OracleEdgeResponse.self, from: data)
            return decoded
        } catch {
            Log.network.error("JSON decode failed: \(error.localizedDescription, privacy: .public)")
            throw error
        }
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
