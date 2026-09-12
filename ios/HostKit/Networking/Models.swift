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
    /// Going / pending / waitlisted; older servers only send `registered`.
    var registration: RegistrationState?
    /// Registrations wait for the host's approval.
    var requiresApproval: Bool?
    /// The first few people going (opted-in account registrations); empty in lists.
    var attendees: [Attendee]?
    /// The club this was posted as, when it was.
    var club: EventClub?
    /// Set on events from a school's official calendar (id starts with
    /// `campus_`): nobody registers here — `url` is the page to open.
    var official: OfficialInfo?

    var isOfficial: Bool { official != nil }

    /// Who to show as the host: the club, else the person.
    var hostLabel: String? { club?.name ?? hostName }
    /// A photo the host uploaded; nil means the cover is drawn from the id.
    var coverUrl: String?
    let webPath: String

    var coverURL: URL? { coverUrl.flatMap(URL.init(string:)) }
    var registrationState: RegistrationState {
        registration ?? ((registered ?? false) ? .going : .none)
    }

    var isRegistered: Bool { registrationState == .going }

    var endsAt: Date? {
        if let official, official.allDay { return nil }
        if let end = official?.endsAt { return end }
        return startsAt.map { $0.addingTimeInterval(TimeInterval(durationHours * 3600)) }
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
    /// Asked to join; the host hasn't decided.
    case pending = "PENDING"
    /// Wants in; the event is full.
    case waitlisted = "WAITLISTED"
    /// A status this build doesn't know — never fail the whole list over it.
    case unknown = "UNKNOWN"

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = RsvpStatus(rawValue: raw) ?? .unknown
    }

    var label: String {
        switch self {
        case .invited: "Invited"
        case .attending: "Going"
        case .declined: "Not going"
        case .maybe: "Maybe"
        case .pending: "Requested"
        case .waitlisted: "Waitlist"
        case .unknown: "—"
        }
    }
}

/// The club an event was posted as. Mirrors `ApiEventClub`.
nonisolated struct EventClub: Codable, Hashable, Sendable {
    let handle: String
    let name: String
    let imageUrl: String?
    let webPath: String
    var imageURL: URL? { imageUrl.flatMap(URL.init(string:)) }
}

/// A club page. Mirrors `ApiClub` in `lib/api/serialize.ts`.
nonisolated struct Club: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let handle: String
    var name: String
    var blurb: String?
    var imageUrl: String?
    var coverUrl: String?
    var school: School?
    var city: String?
    var followers: Int
    var isFollowing: Bool
    var canManage: Bool
    let webPath: String
    var imageURL: URL? { imageUrl.flatMap(URL.init(string:)) }
    var coverURL: URL? { coverUrl.flatMap(URL.init(string:)) }
}

nonisolated struct ClubMemberRow: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let imageUrl: String?
    let role: String
    var imageURL: URL? { imageUrl.flatMap(URL.init(string:)) }
}

nonisolated struct ClubPage: Decodable, Sendable {
    var club: Club
    var events: [HostEvent]
    var members: [ClubMemberRow]
}

nonisolated struct ClubsFeed: Decodable, Sendable {
    var mine: [Club]
    var suggested: [Club]
}

nonisolated struct NewClubRequest: Encodable, Sendable {
    let name: String
    let handle: String
    let blurb: String?
    let city: String?
}

/// Something that happened to you. Mirrors `/api/v1/me/notifications`.
nonisolated struct Notice: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let kind: String
    let title: String
    let body: String
    let eventId: String?
    let clubId: String?
    var readAt: Date?
    let createdAt: Date

    var isUnread: Bool { readAt == nil }
    var symbol: String {
        switch kind {
        case "club_published": "megaphone"
        case "registration_request": "hand.raised"
        case "registration_approved": "checkmark.seal"
        case "waitlist_promoted": "ticket"
        case "blast": "envelope"
        default: "bell"
        }
    }
}

nonisolated struct InboxFeed: Decodable, Sendable {
    var items: [Notice]
    var unread: Int
}

/// A face on the event page. Mirrors `ApiAttendee` in `lib/api/serialize.ts`.
nonisolated struct Attendee: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let firstName: String
    let imageUrl: String?
    var imageURL: URL? { imageUrl.flatMap(URL.init(string:)) }

    /// "Ada, Grace and 12 others are going" — same rules as `goingSentence` on the web.
    static func sentence(_ names: [String], total: Int) -> String {
        if total == 0 { return "Be the first to register" }
        let shown = Array(names.prefix(2))
        let rest = total - shown.count
        let verb = total == 1 ? "is" : "are"
        if shown.isEmpty { return "\(total) \(verb) going" }
        if rest <= 0 { return "\(shown.joined(separator: " and ")) \(verb) going" }
        return "\(shown.joined(separator: ", ")) and \(rest) \(rest == 1 ? "other" : "others") are going"
    }
}

/// Where the signed-in viewer stands with an event. Mirrors `registration`
/// in `lib/api/serialize.ts`; unknown values decode as `.none`.
nonisolated enum RegistrationState: String, Codable, Sendable {
    case none, going, pending, waitlisted

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = RegistrationState(rawValue: raw) ?? .none
    }
}

nonisolated struct Guest: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let email: String?
    /// The registrant's verified number, when their account has one.
    var phone: String?
    let status: RsvpStatus
    let plusOnes: Int
    var checkedInAt: Date?
}

nonisolated struct PhoneStart: Decodable, Sendable {
    let phone: String
    let expiresAt: Date
    /// Only present without an SMS service, outside production.
    let devCode: String?
}

nonisolated struct GuestSummary: Codable, Hashable, Sendable {
    var capacity: Int
    var going: Int
    var checkedIn: Int
    var invited: Int
    var declined: Int
    var pending: Int?
    var waitlisted: Int?
}

/// Mirrors `lib/schools.ts`.
nonisolated struct School: Codable, Hashable, Sendable {
    let domain: String
    let name: String
    let short: String
    let city: String?
}

/// X, LinkedIn and Instagram handles on a profile, with the links rebuilt
/// the way lib/socials.ts does.
nonisolated struct Socials: Codable, Hashable, Sendable {
    var x: String?
    var linkedin: String?
    var instagram: String?

    var isEmpty: Bool { x == nil && linkedin == nil && instagram == nil }

    /// (label, "@handle" or handle, url, SF Symbol) for each set handle.
    var links: [(label: String, display: String, url: URL, symbol: String)] {
        var out: [(String, String, URL, String)] = []
        if let x, let url = URL(string: "https://x.com/\(x)") { out.append(("X", "@\(x)", url, "xmark")) }
        if let linkedin, let url = URL(string: "https://www.linkedin.com/in/\(linkedin)") {
            out.append(("LinkedIn", linkedin, url, "briefcase"))
        }
        if let instagram, let url = URL(string: "https://www.instagram.com/\(instagram)") {
            out.append(("Instagram", "@\(instagram)", url, "camera"))
        }
        return out.map { (label: $0.0, display: $0.1, url: $0.2, symbol: $0.3) }
    }
}

/// A school the person can pick in Settings (`GET /api/v1/schools`).
nonisolated struct SchoolOption: Codable, Hashable, Identifiable, Sendable {
    let domain: String
    let name: String
    let short: String
    let city: String?
    /// True when HostKit syncs this school's official calendar.
    let hasOfficialEvents: Bool
    var id: String { domain }
}

/// Where an official campus event came from, and its real page.
nonisolated struct OfficialInfo: Codable, Hashable, Sendable {
    let source: String
    let url: String
    let allDay: Bool
    let endsAt: Date?

    var pageURL: URL? { URL(string: url) }
}

/// One feed behind a school's official events, for crediting it.
nonisolated struct OfficialSource: Codable, Hashable, Identifiable, Sendable {
    let key: String
    let name: String
    let url: String
    var id: String { key }
}

/// `GET /api/v1/campus`: the school's whole official calendar, soonest first.
nonisolated struct CampusFeed: Decodable, Sendable {
    var school: School?
    var events: [HostEvent] = []
    var sources: [OfficialSource] = []
    var syncedAt: Date?
}

nonisolated struct HostUser: Codable, Hashable, Sendable {
    let id: String
    var name: String
    let email: String
    var school: School?
    var classYear: Int?
    var bio: String?
    /// Where they work; for hosts who aren't students, or are and work too.
    var company: String?
    /// Bare handles (no "@"); older servers don't send this.
    var socials: Socials?
    var imageUrl: String?
    /// E.164, present only once a texted code confirmed it.
    var phone: String?
    var phoneVerified: Bool?
    /// Whether their first name and photo may appear in "who's going".
    var showOnGuestLists: Bool?
    /// The address was confirmed by opening the link we sent; older servers don't say.
    var emailVerified: Bool?

    var isStudent: Bool { school != nil }
    var imageURL: URL? { imageUrl.flatMap(URL.init(string:)) }
    var hasVerifiedPhone: Bool { phone != nil && (phoneVerified ?? false) }
}

/// What Discover shows: the city feed, plus the student's campus nights.
nonisolated struct DiscoverFeed: Decodable, Sendable {
    var events: [HostEvent]
    var campus: [HostEvent] = []
    /// What the viewer hosts or is going to, soonest first. Empty signed out.
    var mine: [HostEvent] = []
    /// Upcoming events from clubs the viewer follows.
    var following: [HostEvent] = []
    /// Clubs worth following at the viewer's school or in the city.
    var clubs: [Club] = []
    var school: School?
    /// The school's own calendar (lib/campus on the server), soonest first.
    var official: [HostEvent] = []
    var officialSources: [OfficialSource] = []

    /// "At [School]": student-hosted nights and official events together, by date.
    var onCampus: [HostEvent] {
        (campus + official).sorted { ($0.startsAt ?? .distantFuture) < ($1.startsAt ?? .distantFuture) }
    }
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
    /// Guests in the segment with a verified phone.
    var phoneCount: Int?
    var id: String { key }
}

nonisolated struct Blast: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let segment: String
    let subject: String
    let body: String
    let recipientCount: Int
    var smsCount: Int?
    let provider: String
    let sentAt: Date
}

nonisolated struct BlastRecipient: Codable, Hashable, Sendable {
    let name: String
    let email: String
}

nonisolated struct BlastsFeed: Decodable, Sendable {
    var canSend: Bool
    /// Twilio is configured, so "Also text" is on offer.
    var canText: Bool?
    var segments: [BlastSegment]
    var blasts: [Blast]
    /// Present on the response to a send.
    var provider: String?
    var recipients: [BlastRecipient]?
    var smsCount: Int?
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
    /// Post as a club the host manages.
    var clubId: String?
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
