import CoreLocation
import Foundation
import SwiftData
import Testing
@testable import daily_oracle

enum TestSupport {
    @MainActor
    static func makeInMemoryModelContainer() throws -> ModelContainer {
        try OracleModelContainer.makeContainer(inMemory: true)
    }

    @MainActor
    static func makeModelContext() throws -> ModelContext {
        ModelContext(try makeInMemoryModelContainer())
    }
}

final class EdgeFunctionServiceSpy: EdgeFunctionServicing, @unchecked Sendable {
    private(set) var receivedRequests: [OracleEdgeRequest] = []
    private let result: Result<OracleEdgeResponse, Error>

    init(result: Result<OracleEdgeResponse, Error>) {
        self.result = result
    }

    func fetchDailyOracle(request: OracleEdgeRequest) async throws -> OracleEdgeResponse {
        receivedRequests.append(request)
        return try result.get()
    }
}

final class WeatherServiceSpy: WeatherServicing, @unchecked Sendable {
    private(set) var receivedLocations: [CLLocation] = []
    private let result: Result<WeatherSnapshot, Error>

    init(result: Result<WeatherSnapshot, Error>) {
        self.result = result
    }

    func weather(for location: CLLocation) async throws -> WeatherSnapshot {
        receivedLocations.append(location)
        return try result.get()
    }
}

final class LocationServiceSpy: LocationServicing, @unchecked Sendable {
    private(set) var requestCount = 0
    private let result: Result<LocationSnapshot, Error>

    init(result: Result<LocationSnapshot, Error>) {
        self.result = result
    }

    func currentLocation() async throws -> LocationSnapshot {
        requestCount += 1
        return try result.get()
    }
}

enum StubError: Error, LocalizedError {
    case failed(String)

    var errorDescription: String? {
        switch self {
        case let .failed(message):
            return message
        }
    }
}

final class URLProtocolStub: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: StubError.failed("Missing URLProtocolStub.handler"))
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
