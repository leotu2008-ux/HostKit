import Foundation

nonisolated struct APIError: LocalizedError, Sendable {
    let message: String
    let status: Int

    var errorDescription: String? { message }

    /// True when the server isn't a HostKit API at all (offline, wrong URL,
    /// or a deploy that predates `/api/v1`), as opposed to a real refusal.
    var isUnreachable: Bool { status == 0 || status == 404 && message == Self.notAnAPI }

    static let notAnAPI = "This server doesn't have the HostKit API yet."
}

/// A thin client for the website's `/api/v1` routes. Stateless and Sendable,
/// so both the UI and App Intents can make one from saved settings.
nonisolated struct APIClient: Sendable {
    let baseURL: URL
    let token: String?
    /// Drafts this device made while signed out; sent on every request so the
    /// server lets us keep managing them.
    var drafts: [DraftClaim] = []

    // MARK: Public nights

    func discover(city: String?) async throws -> DiscoverFeed {
        var path = "/api/v1/discover"
        if let city, let encoded = city.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
            path += "?city=\(encoded)"
        }
        return try await send("GET", path)
    }

    func me() async throws -> HostUser {
        let envelope: UserEnvelope = try await send("GET", "/api/v1/me")
        return envelope.user
    }

    func updateProfile(name: String, classYear: Int?, bio: String?) async throws -> HostUser {
        let body = try Self.encode(ProfilePatch(name: name, classYear: classYear, bio: bio))
        let envelope: UserEnvelope = try await send("PATCH", "/api/v1/me", body: body)
        return envelope.user
    }

    func event(id: String) async throws -> HostEvent {
        let envelope: EventEnvelope = try await send("GET", "/api/v1/events/\(id)")
        return envelope.event
    }

    /// Registers the signed-in account. The server refuses without a token.
    /// Registers and says where you landed: going, pending (host approves),
    /// or waitlisted (the event is full). Older servers answer without a state.
    func register(eventID: String) async throws -> RegistrationState {
        let envelope: RegisterEnvelope = try await send(
            "POST", "/api/v1/events/\(eventID)/register", body: try Self.encode([String: String]()))
        return envelope.state ?? .going
    }

    /// The host decides for one guest: approve/decline a request, or change a reply.
    func setGuestStatus(eventID: String, guestID: String, status: RsvpStatus) async throws -> Guest {
        let envelope: GuestEnvelope = try await send(
            "PATCH", "/api/v1/events/\(eventID)/guests/\(guestID)",
            body: try Self.encode(["status": status.rawValue]))
        return envelope.guest
    }

    // MARK: Host

    func signIn(email: String, password: String) async throws -> (token: String, user: HostUser) {
        let body = try Self.encode(["email": email, "password": password])
        let envelope: TokenEnvelope = try await send("POST", "/api/v1/auth/token", body: body)
        return (envelope.token, envelope.user)
    }

    /// Creates an account and signs it in. A .edu email makes it a student.
    func signUp(name: String, email: String, password: String) async throws -> (token: String, user: HostUser) {
        let body = try Self.encode(["name": name, "email": email, "password": password])
        let envelope: TokenEnvelope = try await send("POST", "/api/v1/auth/signup", body: body)
        return (envelope.token, envelope.user)
    }

    func myEvents() async throws -> [HostEvent] {
        let envelope: EventsEnvelope = try await send("GET", "/api/v1/events")
        return envelope.events
    }

    /// Creates a night. Signed out, the server also returns a claim token —
    /// the caller must remember it or the draft is orphaned.
    func createEvent(_ request: NewEventRequest) async throws -> (event: HostEvent, claimToken: String?) {
        let envelope: CreateEnvelope = try await send("POST", "/api/v1/events", body: try Self.encode(request))
        return (envelope.event, envelope.claimToken)
    }

    /// Hands the device's drafts to the signed-in host. Returns the ids that
    /// actually moved.
    func claimDrafts(_ drafts: [DraftClaim]) async throws -> [String] {
        let body = try Self.encode(["drafts": drafts])
        let envelope: ClaimEnvelope = try await send("POST", "/api/v1/drafts/claim", body: body)
        return envelope.claimed
    }

    func setPublished(
        eventID: String, published: Bool, visibility: EventVisibility? = nil, requiresApproval: Bool? = nil
    ) async throws -> HostEvent {
        let body = try Self.encode(PublishBody(published: published, visibility: visibility, requiresApproval: requiresApproval))
        let envelope: EventEnvelope = try await send("POST", "/api/v1/events/\(eventID)/publish", body: body)
        return envelope.event
    }

    // MARK: Manage — outreach & blasts

    func outreach(eventID: String) async throws -> [OutreachRow] {
        let envelope: OutreachFeed = try await send("GET", "/api/v1/events/\(eventID)/outreach")
        return envelope.rows
    }

    func addCollaborator(eventID: String, _ collaborator: NewCollaborator) async throws -> [OutreachRow] {
        let envelope: OutreachFeed = try await send(
            "POST", "/api/v1/events/\(eventID)/outreach", body: try Self.encode(collaborator))
        return envelope.rows
    }

    func setCollaboratorStatus(eventID: String, rowID: String, status: String) async throws -> [OutreachRow] {
        let envelope: OutreachFeed = try await send(
            "PATCH", "/api/v1/events/\(eventID)/outreach/\(rowID)", body: try Self.encode(["status": status]))
        return envelope.rows
    }

    func removeCollaborator(eventID: String, rowID: String) async throws -> [OutreachRow] {
        let envelope: OutreachFeed = try await send("DELETE", "/api/v1/events/\(eventID)/outreach/\(rowID)")
        return envelope.rows
    }

    func blasts(eventID: String) async throws -> BlastsFeed {
        try await send("GET", "/api/v1/events/\(eventID)/blasts")
    }

    func sendBlast(eventID: String, segment: String, subject: String, body: String) async throws -> BlastsFeed {
        try await send(
            "POST", "/api/v1/events/\(eventID)/blasts",
            body: try Self.encode(["segment": segment, "subject": subject, "body": body]))
    }

    func guests(eventID: String) async throws -> GuestsEnvelope {
        try await send("GET", "/api/v1/events/\(eventID)/guests")
    }

    func setCheckedIn(eventID: String, guestID: String, checkedIn: Bool) async throws -> Guest {
        let body = try Self.encode(["checkedIn": checkedIn])
        let envelope: GuestEnvelope = try await send(
            "POST", "/api/v1/events/\(eventID)/guests/\(guestID)/check-in", body: body)
        return envelope.guest
    }

    func webURL(for event: HostEvent) -> URL {
        baseURL.appending(path: event.webPath)
    }

    // MARK: Photos — the image is the request body

    func setAvatar(_ data: Data, contentType: String) async throws -> HostUser {
        let envelope: UserEnvelope = try await send("PUT", "/api/v1/me/avatar", body: data, contentType: contentType)
        return envelope.user
    }

    func removeAvatar() async throws -> HostUser {
        let envelope: UserEnvelope = try await send("DELETE", "/api/v1/me/avatar")
        return envelope.user
    }

    func setCover(eventID: String, _ data: Data, contentType: String) async throws -> HostEvent {
        let envelope: EventEnvelope = try await send(
            "PUT", "/api/v1/events/\(eventID)/cover", body: data, contentType: contentType)
        return envelope.event
    }

    func removeCover(eventID: String) async throws -> HostEvent {
        let envelope: EventEnvelope = try await send("DELETE", "/api/v1/events/\(eventID)/cover")
        return envelope.event
    }

    // MARK: Phone verification

    func startPhone(_ phone: String) async throws -> PhoneStart {
        try await send("POST", "/api/v1/me/phone", body: Self.encode(PhoneBody(phone: phone)))
    }

    func verifyPhone(code: String) async throws -> HostUser {
        let envelope: UserEnvelope = try await send(
            "POST", "/api/v1/me/phone/verify", body: Self.encode(CodeBody(code: code)))
        return envelope.user
    }

    func removePhone() async throws -> HostUser {
        let envelope: UserEnvelope = try await send("DELETE", "/api/v1/me/phone")
        return envelope.user
    }

    // MARK: Plumbing

    private func send<T: Decodable>(
        _ method: String, _ path: String, body: Data? = nil, contentType: String = "application/json"
    ) async throws -> T {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError(message: "That server address doesn't look right.", status: 0)
        }
        var request = URLRequest(url: url, timeoutInterval: body == nil ? 15 : 60)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if !drafts.isEmpty {
            let pairs = drafts.map { "\($0.id).\($0.token)" }.joined(separator: ",")
            request.setValue(pairs, forHTTPHeaderField: "X-HostKit-Drafts")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError(message: "Couldn't reach \(baseURL.host() ?? "the server").", status: 0)
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let isJSON = (response as? HTTPURLResponse)?
            .value(forHTTPHeaderField: "Content-Type")?.contains("application/json") ?? false

        guard (200..<300).contains(status) else {
            if isJSON, let failure = try? Self.decoder().decode(ErrorEnvelope.self, from: data) {
                throw APIError(message: failure.error, status: status)
            }
            throw APIError(message: status == 404 ? APIError.notAnAPI : "The server said \(status).", status: status)
        }
        do {
            return try Self.decoder().decode(T.self, from: data)
        } catch {
            throw APIError(message: APIError.notAnAPI, status: 404)
        }
    }

    private static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let raw = try decoder.singleValueContainer().decode(String.self)
            if let date = try? Date(raw, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true)) {
                return date
            }
            if let date = try? Date(raw, strategy: .iso8601) {
                return date
            }
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unreadable date \(raw)"))
        }
        return decoder
    }

    private static func encode<T: Encodable>(_ value: T) throws -> Data {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return try encoder.encode(value)
    }
}

nonisolated struct EventsEnvelope: Decodable, Sendable { let events: [HostEvent] }
nonisolated struct EventEnvelope: Decodable, Sendable { let event: HostEvent }
nonisolated struct CreateEnvelope: Decodable, Sendable {
    let event: HostEvent
    let claimToken: String?
}
nonisolated struct ClaimEnvelope: Decodable, Sendable { let claimed: [String] }
nonisolated struct UserEnvelope: Decodable, Sendable { let user: HostUser }
nonisolated struct PublishBody: Encodable, Sendable {
    let published: Bool
    let visibility: EventVisibility?
    let requiresApproval: Bool?
}
nonisolated struct RegisterEnvelope: Decodable, Sendable {
    let ok: Bool
    let state: RegistrationState?
}
nonisolated struct PhoneBody: Encodable, Sendable { let phone: String }
nonisolated struct CodeBody: Encodable, Sendable { let code: String }
nonisolated struct ProfilePatch: Encodable, Sendable {
    let name: String
    let classYear: Int?
    let bio: String?
}
nonisolated struct GuestEnvelope: Decodable, Sendable { let guest: Guest }
nonisolated struct GuestsEnvelope: Decodable, Sendable {
    let guests: [Guest]
    let summary: GuestSummary
}
nonisolated struct TokenEnvelope: Decodable, Sendable {
    let token: String
    let user: HostUser
}
nonisolated struct OKEnvelope: Decodable, Sendable { let ok: Bool }
nonisolated struct ErrorEnvelope: Decodable, Sendable { let error: String }
