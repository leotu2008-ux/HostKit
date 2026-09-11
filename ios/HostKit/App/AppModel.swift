import Foundation
import Observation

/// Signed-in state and data loading for the views.
///
/// When the server can't be reached — offline, or a deploy that doesn't have
/// `/api/v1` yet — public screens fall back to built-in sample nights and say
/// so, so the app is always explorable.
@Observable
final class AppModel {
    private(set) var user: HostUser? = Session.user
    private(set) var serverURL: URL = Session.serverURL
    var sampleNotice: String?

    var isSignedIn: Bool { user != nil && Session.token != nil }

    var api: APIClient { Session.client() }

    // MARK: Account

    func signIn(email: String, password: String) async throws {
        let result = try await api.signIn(email: email, password: password)
        Session.token = result.token
        Session.user = result.user
        user = result.user
    }

    func signOut() {
        Session.token = nil
        Session.user = nil
        user = nil
    }

    /// Saves a new server address. Returns false if it isn't an http(s) URL.
    func setServer(_ raw: String) -> Bool {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed), let scheme = url.scheme,
              ["http", "https"].contains(scheme), url.host() != nil
        else { return false }
        if url != serverURL { signOut() }
        Session.serverURL = url
        serverURL = url
        return true
    }

    // MARK: Data

    func discover(city: String?) async -> [HostEvent] {
        do {
            let events = try await api.discover(city: city)
            sampleNotice = nil
            return events
        } catch let error as APIError where error.isUnreachable {
            sampleNotice = "\(error.message) Showing sample events."
            return SampleData.events.filter { city == nil || $0.city == city }
        } catch {
            sampleNotice = error.localizedDescription
            return []
        }
    }

    func event(id: String) async throws -> HostEvent {
        if let sample = SampleData.events.first(where: { $0.id == id }) {
            return sample
        }
        return try await api.event(id: id)
    }

    func register(for event: HostEvent, name: String, email: String) async throws {
        if SampleData.events.contains(where: { $0.id == event.id }) {
            try await Task.sleep(for: .milliseconds(500))
            return
        }
        try await api.register(eventID: event.id, name: name, email: email)
    }
}
