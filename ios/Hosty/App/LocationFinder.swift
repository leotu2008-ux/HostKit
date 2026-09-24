import CoreLocation

/// Asks once where the phone is and names the nearest known city.
///
/// No geocoding service: the city list is short and each city has a centre,
/// so "which city am I in" is a distance check (see `Cities.nearest`). A
/// denied prompt just means Discover stays on whatever city it had.
nonisolated enum LocationFinder {
    static func currentCity() async -> String? {
        let manager = CLLocationManager()
        if manager.authorizationStatus == .notDetermined {
            manager.requestWhenInUseAuthorization()
            // Give the prompt a moment; liveUpdates will still wait for a
            // real answer below.
            try? await Task.sleep(for: .milliseconds(300))
        }
        guard manager.authorizationStatus == .authorizedWhenInUse
            || manager.authorizationStatus == .authorizedAlways
            || manager.authorizationStatus == .notDetermined
        else { return nil }

        do {
            for try await update in CLLocationUpdate.liveUpdates() {
                if update.authorizationDenied || update.authorizationRestricted { return nil }
                if let location = update.location {
                    return Cities.nearest(
                        lat: location.coordinate.latitude,
                        lng: location.coordinate.longitude)
                }
            }
        } catch {
            return nil
        }
        return nil
    }
}
