//
//  LocationService.swift
//  daily-oracle
//

import Foundation
import CoreLocation

protocol LocationServicing: Sendable {
    func currentLocation() async throws -> LocationSnapshot
}

struct LocationService: LocationServicing {
    enum Mode: Sendable {
        case mock
        case live
    }

    private let mode: Mode

    init(mode: Mode = .mock) {
        self.mode = mode
    }

    func currentLocation() async throws -> LocationSnapshot {
        switch mode {
        case .mock:
            return .init(latitude: 30.2741, longitude: 120.1551, cityName: "杭州")
        case .live:
            return try await LocationManagerBridge().requestCurrentLocation()
        }
    }
}

enum LocationServiceError: LocalizedError {
    case permissionDenied
    case unableToLocate

    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "定位权限不可用。"
        case .unableToLocate:
            return "暂时拿不到当前位置。"
        }
    }
}

@MainActor
private final class LocationManagerBridge: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<LocationSnapshot, Error>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    func requestCurrentLocation() async throws -> LocationSnapshot {
        let status = manager.authorizationStatus
        if status == .denied || status == .restricted {
            throw LocationServiceError.permissionDenied
        }

        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation

            switch manager.authorizationStatus {
            case .notDetermined:
                manager.requestWhenInUseAuthorization()
            case .authorizedAlways, .authorizedWhenInUse:
                manager.requestLocation()
            case .denied, .restricted:
                continuation.resume(throwing: LocationServiceError.permissionDenied)
                self.continuation = nil
            @unknown default:
                continuation.resume(throwing: LocationServiceError.unableToLocate)
                self.continuation = nil
            }
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            manager.requestLocation()
        case .denied, .restricted:
            continuation?.resume(throwing: LocationServiceError.permissionDenied)
            continuation = nil
        default:
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else {
            continuation?.resume(throwing: LocationServiceError.unableToLocate)
            continuation = nil
            return
        }

        continuation?.resume(returning: .init(location: location))
        continuation = nil
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }
}
