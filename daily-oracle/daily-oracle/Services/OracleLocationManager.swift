import CoreLocation
import Foundation

@MainActor
final class OracleLocationManager: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<OracleLocationState, Never>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    func requestCurrentLocation() async -> OracleLocationState {
        if let location = manager.location {
            return .available(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude)
        }

        let status = manager.authorizationStatus
        switch status {
        case .authorizedAlways, .authorizedWhenInUse:
            return await withCheckedContinuation { continuation in
                self.continuation = continuation
                manager.requestLocation()
            }
        case .notDetermined:
            return await withCheckedContinuation { continuation in
                self.continuation = continuation
                manager.requestWhenInUseAuthorization()
            }
        case .denied, .restricted:
            return .denied
        @unknown default:
            return .failed("权限异常")
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            switch manager.authorizationStatus {
            case .authorizedAlways, .authorizedWhenInUse:
                manager.requestLocation()
            case .denied, .restricted:
                continuation?.resume(returning: .denied)
                continuation = nil
            case .notDetermined:
                break
            @unknown default:
                continuation?.resume(returning: .failed("权限异常"))
                continuation = nil
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        Task { @MainActor in
            continuation?.resume(returning: .available(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude))
            continuation = nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            continuation?.resume(returning: .failed(error.localizedDescription))
            continuation = nil
        }
    }
}
