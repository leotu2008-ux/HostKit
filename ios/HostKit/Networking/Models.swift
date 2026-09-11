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
    /// The host's school, when the host is a student. Surfacing only —
    /// anyone can attend.
    var school: School?
    let isOwner: Bool
    /// True when the signed-in account is registered as attending.
    var registered: Bool?
    let webPath: String

    var isRegistered: Bool { registered ?? false }

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

/// Mirrors `lib/schools.ts`.
nonisolated struct School: Codable, Hashable, Sendable {
    let domain: String
    let name: String
    let short: String
    let city: String?
}

nonisolated struct HostUser: Codable, Hashable, Sendable {
    let id: String
    var name: String
    let email: String
    var school: School?
    var classYear: Int?
    var bio: String?

    var isStudent: Bool { school != nil }
}

/// What Discover shows: the city feed, plus the student's campus nights.
nonisolated struct DiscoverFeed: Decodable, Sendable {
    var events: [HostEvent]
    var campus: [HostEvent] = []
    var school: School?
}

// MARK: Manage — outreach, blasts

/// One person or place to reach. Mirrors `OutreachRow` in `lib/api/outreach.ts`.
nonisolated struct OutreachRow: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let kind: String
    let name: String
    let detail: String?
    let email: String?
    let phone: String?
    let website: String?
    let status: String
    let source: String
    let listingPath: String?
    let subject: String
    let message: String

    var isCollaborator: Bool { source == "collaborator" }
    var isConfirmed: Bool { status == "CONFIRMED" || status == "BOOKED" }

    var kindLabel: String {
        switch kind {
        case "VENUE": "Venue"
        case "SPEAKER": "Speaker"
        case "COHOST": "Cohost"
        default: "Vendor"
        }
    }

    var statusLabel: String {
        switch status {
        case "PENDING": "Not yet asked"
        case "SENT": "Asked"
        case "REPLIED": "Replied"
        case "QUOTED": "Quoted"
        case "CONFIRMED": "Confirmed"
        case "BOOKED": "Booked"
        case "DECLINED": "Declined"
        default: status.capitalized
        }
    }
}

nonisolated struct OutreachFeed: Decodable, Sendable { let rows: [OutreachRow] }

nonisolated struct NewCollaborator: Encodable, Sendable {
    var kind: String
    var name: String
    var email: String?
    var phone: String?
    var website: String?
    var detail: String?
}

nonisolated struct BlastSegment: Codable, Identifiable, Hashable, Sendable {
    let key: String
    let label: String
    let count: Int
    var id: String { key }
}

nonisolated struct Blast: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let segment: String
    let subject: String
    let body: String
    let recipientCount: Int
    let provider: String
    let sentAt: Date
}

nonisolated struct BlastRecipient: Codable, Hashable, Sendable {
    let name: String
    let email: String
}

nonisolated struct BlastsFeed: Decodable, Sendable {
    var canSend: Bool
    var segments: [BlastSegment]
    var blasts: [Blast]
    /// Present on the response to a send.
    var provider: String?
    var recipients: [BlastRecipient]?
}

/// A venue picked from MapKit on Create. Mirrors `VenuePick` on the server.
nonisolated struct VenuePick: Codable, Hashable, Identifiable, Sendable {
    var name: String
    var address: String?
    var phone: String?
    var website: String?
    var externalId: String?
    var lat: Double?
    var lng: Double?

    var id: String { externalId ?? "\(name)@\(lat ?? 0),\(lng ?? 0)" }
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
    var venue: VenuePick?
}

/// The cities HostKit knows; matches `CITIES` and `CITY_CENTERS` in
/// `lib/catalog.ts`.
nonisolated enum Cities {
    static let all = ["New York, NY", "Los Angeles, CA", "Austin, TX", "Boston, MA"]

    private static let centers: [String: (lat: Double, lng: Double)] = [
        "New York, NY": (40.7128, -74.006),
        "Los Angeles, CA": (34.0522, -118.2437),
        "Austin, TX": (30.2672, -97.7431),
        "Boston, MA": (42.3601, -71.0589),
    ]

    /// Same rule as the website: the closest centre within 60 miles.
    private static let radiusMiles = 60.0

    static func short(_ city: String) -> String {
        city.split(separator: ",").first.map(String.init) ?? city
    }

    static func center(of city: String) -> (lat: Double, lng: Double)? {
        centers[city]
    }

    static func nearest(lat: Double, lng: Double) -> String? {
        var best: (city: String, miles: Double)?
        for city in all {
            guard let c = centers[city] else { continue }
            let miles = milesBetween(lat, lng, c.lat, c.lng)
            if best == nil || miles < best!.miles { best = (city, miles) }
        }
        guard let best, best.miles <= radiusMiles else { return nil }
        return best.city
    }

    private static func milesBetween(_ lat1: Double, _ lng1: Double, _ lat2: Double, _ lng2: Double) -> Double {
        let toRad = { (d: Double) in d * .pi / 180 }
        let dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
        let a = sin(dLat / 2) * sin(dLat / 2)
            + cos(toRad(lat1)) * cos(toRad(lat2)) * sin(dLng / 2) * sin(dLng / 2)
        return 3958.8 * 2 * atan2(sqrt(a), sqrt(1 - a))
    }
}
