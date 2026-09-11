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
    /// Nights drafted on this phone before signing in.
    private(set) var drafts: [DraftClaim] = Session.drafts
    var sampleNotice: String?

    var isSignedIn: Bool { user != nil && Session.token != nil }

    /// True when the Events tab has something to show: owned nights, or
    /// drafts waiting for a sign-in.
    var hasNights: Bool { isSignedIn || !drafts.isEmpty }

    var api: APIClient { Session.client() }

    // MARK: Account

    /// Signs in, then hands any drafts made on this phone to that account —
    /// the same thing the website does with its draft cookie.
    func signIn(email: String, password: String) async throws {
        let result = try await api.signIn(email: email, password: password)
        Session.token = result.token
        Session.user = result.user
        user = result.user
        await claimDrafts()
    }

    func signOut() {
        Session.token = nil
        Session.user = nil
        user = nil
    }

    func claimDrafts() async {
        guard isSignedIn, !drafts.isEmpty else { return }
        if let claimed = try? await api.claimDrafts(drafts) {
            Session.forgetDrafts(claimed)
            drafts = Session.drafts
        }
    }

    /// Saves a new server address. Returns false if it isn't an http(s) URL.
    func setServer(_ raw: String) -> Bool {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed), let scheme = url.scheme,
              ["http", "https"].contains(scheme), url.host() != nil
        else { return false }
        if url != serverURL {
            signOut()
            // Drafts belong to the server that issued their tokens.
            Session.drafts = []
            drafts = []
        }
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

    /// Creates a night. Signed out, it's a draft kept on this phone until the
    /// host signs in to publish it.
    func createEvent(_ request: NewEventRequest) async throws -> HostEvent {
        let result = try await api.createEvent(request)
        if let token = result.claimToken {
            Session.rememberDraft(DraftClaim(id: result.event.id, token: token))
            drafts = Session.drafts
        }
        return result.event
    }

    /// Publishing is the one step that needs an account. A draft becomes the
    /// signed-in host's on the way through, so it's no longer tracked here.
    func setPublished(_ event: HostEvent, _ published: Bool) async throws -> HostEvent {
        let updated = try await api.setPublished(eventID: event.id, published: published)
        if drafts.contains(where: { $0.id == event.id }) {
            Session.forgetDrafts([event.id])
            drafts = Session.drafts
        }
        return updated
    }

    func register(for event: HostEvent, name: String, email: String) async throws {
        if SampleData.events.contains(where: { $0.id == event.id }) {
            try await Task.sleep(for: .milliseconds(500))
            return
        }
        try await api.register(eventID: event.id, name: name, email: email)
    }
}
