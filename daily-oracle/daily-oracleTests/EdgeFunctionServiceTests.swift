import Foundation
import Testing
@testable import daily_oracle

@MainActor
@Suite(.serialized)
struct EdgeFunctionServiceTests {
    @Test
    func fetchDailyOracleBuildsRequestAndDecodesResponse() async throws {
        let session = makeSession()
        URLProtocolStub.handler = { request in
            #expect(request.url?.absoluteString == "https://example.supabase.co/functions/v1/daily-oracle")
            #expect(request.httpMethod == "POST")
            #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
            #expect(request.value(forHTTPHeaderField: "apikey") == "pk_test")
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer pk_test")

            let body = try #require(requestBodyData(from: request))
            let payload = try JSONDecoder().decode(OracleEdgeRequest.self, from: body)
            #expect(payload.geo == nil)
            #expect(payload.weather == nil)
            #expect(payload.preferences.mood == "calm")
            #expect(payload.preferences.genreHistory == ["essay"])

            let response = HTTPURLResponse(
                url: try #require(request.url),
                statusCode: 200,
                httpVersion: nil,
                headerFields: nil
            )!
            let data = """
            {
              "quote": {
                "id": "quote-1",
                "text": "A",
                "author": "B",
                "work": "C",
                "year": 2020
              },
              "almanac": {
                "yi": "宜",
                "ji": "忌"
              },
              "date": "2026-04-03"
            }
            """.data(using: .utf8)!

            return (response, data)
        }
        defer { URLProtocolStub.handler = nil }

        let service = EdgeFunctionService(
            baseURL: URL(string: "https://example.supabase.co")!,
            publishableKey: "pk_test",
            session: session
        )

        let response = try await service.fetchDailyOracle(request: .fixture())

        #expect(response.quote.id == "quote-1")
        #expect(response.quote.text == "A")
        #expect(response.almanac.yi == "宜")
        #expect(response.date == "2026-04-03")
    }

    @Test
    func fetchDailyOracleWrapsNonSuccessStatusCodes() async throws {
        let session = makeSession()
        URLProtocolStub.handler = { request in
            let response = HTTPURLResponse(
                url: try #require(request.url),
                statusCode: 503,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, Data("service unavailable".utf8))
        }
        defer { URLProtocolStub.handler = nil }

        let service = EdgeFunctionService(
            baseURL: URL(string: "https://example.supabase.co")!,
            publishableKey: "pk_test",
            session: session
        )

        do {
            _ = try await service.fetchDailyOracle(request: .fixture())
            Issue.record("Expected requestFailed error")
        } catch let error as EdgeFunctionError {
            guard case let .requestFailed(statusCode, message) = error else {
                Issue.record("Unexpected EdgeFunctionError case: \(error.localizedDescription)")
                return
            }

            #expect(statusCode == 503)
            #expect(message == "service unavailable")
        } catch {
            Issue.record("Unexpected error: \(error.localizedDescription)")
        }
    }
}

private extension EdgeFunctionServiceTests {
    func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [URLProtocolStub.self]
        return URLSession(configuration: configuration)
    }

    func requestBodyData(from request: URLRequest) -> Data? {
        if let body = request.httpBody {
            return body
        }

        guard let stream = request.httpBodyStream else {
            return nil
        }

        stream.open()
        defer { stream.close() }

        let bufferSize = 1024
        var data = Data()
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }

        while stream.hasBytesAvailable {
            let bytesRead = stream.read(buffer, maxLength: bufferSize)
            guard bytesRead > 0 else { break }
            data.append(buffer, count: bytesRead)
        }

        return data.isEmpty ? nil : data
    }
}

private extension OracleEdgeRequest {
    static func fixture() -> Self {
        .init(
            geo: nil,
            weather: nil,
            profile: .init(lang: "zh", region: "CN", pro: false),
            preferences: .init(mood: "calm", moodHistory: [], genreHistory: ["essay"])
        )
    }
}
