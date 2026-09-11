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

    // MARK: Public nights

    func discover(city: String?) async throws -> [HostEvent] {
        var path = "/api/v1/discover"
        if let city, let encoded = city.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
            path += "?city=\(encoded)"
        }
        let envelope: EventsEnvelope = try await send("GET", path)
        return envelope.events
    }

    func event(id: String) async throws -> HostEvent {
        let envelope: EventEnvelope = try await send("GET", "/api/v1/events/\(id)")
        return envelope.event
    }

    func register(eventID: String, name: String, email: String) async throws {
        let body = try Self.encode(["name": name, "email": email])
        let _: OKEnvelope = try await send("POST", "/api/v1/events/\(eventID)/register", body: body)
    }

    // MARK: Host

    func signIn(email: String, password: String) async throws -> (token: String, user: HostUser) {
        let body = try Self.encode(["email": email, "password": password])
        let envelope: TokenEnvelope = try await send("POST", "/api/v1/auth/token", body: body)
        return (envelope.token, envelope.user)
    }

    func myEvents() async throws -> [HostEvent] {
        let envelope: EventsEnvelope = try await send("GET", "/api/v1/events")
        return envelope.events
    }

    func createEvent(_ request: NewEventRequest) async throws -> HostEvent {
        let envelope: EventEnvelope = try await send("POST", "/api/v1/events", body: try Self.encode(request))
        return envelope.event
    }

    func setPublished(eventID: String, published: Bool) async throws -> HostEvent {
        let body = try Self.encode(["published": published])
        let envelope: EventEnvelope = try await send("POST", "/api/v1/events/\(eventID)/publish", body: body)
        return envelope.event
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

    // MARK: Plumbing

    private func send<T: Decodable>(_ method: String, _ path: String, body: Data? = nil) async throws -> T {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError(message: "That server address doesn't look right.", status: 0)
        }
        var request = URLRequest(url: url, timeoutInterval: 15)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
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
