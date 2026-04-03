//
//  LocationService.swift
//  daily-oracle
//

import Foundation
import CoreLocation
import OSLog

protocol LocationServicing: Sendable {
    func currentLocation() async throws -> LocationSnapshot
}

struct LocationService: LocationServicing {
    func currentLocation() async throws -> LocationSnapshot {
        return try await LocationManagerBridge().requestCurrentLocation()
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
            Log.location.warning("didUpdateLocations called with empty array")
            continuation?.resume(throwing: LocationServiceError.unableToLocate)
            continuation = nil
            return
        }

        Log.location.info("Location: \(location.coordinate.latitude), \(location.coordinate.longitude)")
        continuation?.resume(returning: .init(location: location))
        continuation = nil
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Log.location.error("Location failed: \(error.localizedDescription, privacy: .public)")
        continuation?.resume(throwing: error)
        continuation = nil
    }
}
