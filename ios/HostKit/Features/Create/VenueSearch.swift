import MapKit

/// Real venues near a city, straight from MapKit — no server, no key. The
/// website does the same search through Apple's Maps Server API, so both
/// find the same places.
nonisolated enum VenueSearch {
    static func search(_ query: String, city: String) async throws -> [VenuePick] {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.resultTypes = .pointOfInterest
        if let centre = Cities.center(of: city) {
            request.region = MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: centre.lat, longitude: centre.lng),
                latitudinalMeters: 40_000,
                longitudinalMeters: 40_000)
        }
        let response = try await MKLocalSearch(request: request).start()
        return response.mapItems.prefix(12).map { item in
            VenuePick(
                name: item.name ?? "Unnamed place",
                address: item.address?.fullAddress,
                phone: item.phoneNumber,
                website: item.url?.absoluteString,
                externalId: item.identifier?.rawValue,
                lat: item.location.coordinate.latitude,
                lng: item.location.coordinate.longitude)
        }
    }
}
