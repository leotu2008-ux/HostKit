import Foundation

/// Mirrors `lib/api/serialize.ts`. Keep the two in step.
nonisolated struct HostEvent: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let type: EventKind
    let typeLabel: String
    let description: String?
    let city: String
    let address: String?
    let lat: Double?
    let lng: Double?
    /// The host's wall-clock start, encoded as UTC. Always format with
    /// `EventDates`, which reads it in UTC, so times match the website.
    let startsAt: Date?
    let durationHours: Int
    let capacity: Int
    var going: Int
    let ticketType: TicketType
    let ticketPriceCents: Int
    let visibility: EventVisibility
    var published: Bool
    let hostName: String?
    let isOwner: Bool
    let webPath: String

    var endsAt: Date? {
        startsAt.map { $0.addingTimeInterval(TimeInterval(durationHours * 3600)) }
    }

    var spotsLeft: Int { max(0, capacity - going) }

    var isFull: Bool { spotsLeft == 0 }

    var ticketLabel: String {
        ticketType == .free
            ? "Free"
            : (Double(ticketPriceCents) / 100).formatted(.currency(code: "USD"))
    }

    var statusLabel: String {
        guard published else { return "Draft" }
        return visibility.label
    }

    var place: String { address ?? city }
}

/// HostKit is for student, professional and fun events — no weddings or
/// family occasions. Mirrors `EventType` in prisma/schema.prisma.
nonisolated enum EventKind: String, Codable, CaseIterable, Identifiable, Sendable {
    case birthday = "BIRTHDAY"
    case corporateOffsite = "CORPORATE_OFFSITE"
    case launchParty = "LAUNCH_PARTY"
    case dinnerParty = "DINNER_PARTY"
    case fundraiser = "FUNDRAISER"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .birthday: "Birthday party"
        case .corporateOffsite: "Corporate offsite"
        case .launchParty: "Launch party"
        case .dinnerParty: "Dinner party"
        case .fundraiser: "Fundraiser"
        }
    }
}

nonisolated enum TicketType: String, Codable, Sendable {
    case free = "FREE"
    case paid = "PAID"
}

nonisolated enum EventVisibility: String, Codable, CaseIterable, Identifiable, Sendable {
    case `public` = "PUBLIC"
    case unlisted = "UNLISTED"
    case `private` = "PRIVATE"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .public: "Public"
        case .unlisted: "Unlisted"
        case .private: "Private"
        }
    }

    var hint: String {
        switch self {
        case .public: "Listed on Discover once published."
        case .unlisted: "Anyone with the link can register."
        case .private: "Only you, even after publishing."
        }
    }
}

nonisolated enum RsvpStatus: String, Codable, Sendable {
    case invited = "INVITED"
    case attending = "ATTENDING"
    case declined = "DECLINED"
    case maybe = "MAYBE"

    var label: String {
        switch self {
        case .invited: "Invited"
        case .attending: "Going"
        case .declined: "Not going"
        case .maybe: "Maybe"
        }
    }
}

nonisolated struct Guest: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let email: String?
    let status: RsvpStatus
    let plusOnes: Int
    var checkedInAt: Date?
}

nonisolated struct GuestSummary: Codable, Hashable, Sendable {
    var capacity: Int
    var going: Int
    var checkedIn: Int
    var invited: Int
    var declined: Int
}

nonisolated struct HostUser: Codable, Hashable, Sendable {
    let id: String
    let name: String
    let email: String
}

nonisolated struct NewEventRequest: Encodable, Sendable {
    var title: String
    var type: EventKind
    var startsAt: Date?
    var durationHours: Int
    var capacity: Int
    var city: String
    var address: String?
    var description: String?
    var ticketType: TicketType
    var ticketPriceCents: Int?
    var visibility: EventVisibility
    var budgetCents: Int?
    var publish: Bool
}

/// The cities the catalog covers; matches `CITIES` in `lib/catalog.ts`.
nonisolated enum Cities {
    static let all = ["New York, NY", "Los Angeles, CA", "Austin, TX"]

    static func short(_ city: String) -> String {
        city.split(separator: ",").first.map(String.init) ?? city
    }
}
