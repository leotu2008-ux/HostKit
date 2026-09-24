import AppIntents
import Foundation

// Siri, Shortcuts and Spotlight hooks. Intents read the saved server and
// token through `Session`, so they work without any screen being open.

nonisolated struct HostEventEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Event"
    static let defaultQuery = HostEventQuery()

    let id: String
    let title: String
    let startsAt: Date?
    let going: Int

    init(_ event: HostEvent) {
        id = event.id
        title = event.title
        startsAt = event.startsAt
        going = event.going
    }

    var whenText: String {
        guard let startsAt else { return "not scheduled yet" }
        return "\(EventDates.longDay(startsAt)) at \(EventDates.time(startsAt))"
    }

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)", subtitle: "\(whenText) · \(going) going")
    }
}

nonisolated struct HostEventQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [HostEventEntity] {
        try await Self.upcoming().filter { identifiers.contains($0.id) }
    }

    func entities(matching string: String) async throws -> [HostEventEntity] {
        try await Self.upcoming().filter { $0.title.localizedCaseInsensitiveContains(string) }
    }

    func suggestedEntities() async throws -> [HostEventEntity] {
        try await Self.upcoming()
    }

    /// The signed-in host's nights that haven't happened yet, soonest first.
    static func upcoming() async throws -> [HostEventEntity] {
        guard Session.token != nil else { throw IntentMessage.signIn }
        let events = try await Session.client().myEvents()
        return events
            .filter { !EventDates.isPast($0) }
            .sorted { ($0.startsAt ?? .distantFuture) < ($1.startsAt ?? .distantFuture) }
            .map(HostEventEntity.init)
    }
}

nonisolated enum IntentMessage: Error, CustomLocalizedStringResourceConvertible {
    case signIn
    case noEvents
    case guestNotFound(String)

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .signIn: "Sign in to Hosty first."
        case .noEvents: "You don’t have any upcoming events."
        case .guestNotFound(let name): "I couldn’t find \(name) on the guest list."
        }
    }
}

/// "What's my next event in Hosty?"
nonisolated struct NextEventIntent: AppIntent {
    static let title: LocalizedStringResource = "Next Event"
    static let description = IntentDescription(
        "Tells you when your next Hosty event is and how many people are going.")

    func perform() async throws -> some IntentResult & ProvidesDialog & ReturnsValue<HostEventEntity> {
        guard let next = try await HostEventQuery.upcoming().first else {
            throw IntentMessage.noEvents
        }
        return .result(
            value: next,
            dialog: "\(next.title) is \(next.whenText). \(next.going) going so far.")
    }
}

/// "Open Rooftop Jazz Night in Hosty"
struct OpenEventIntent: OpenIntent {
    static let title: LocalizedStringResource = "Open Event"
    static let description = IntentDescription("Opens one of your events in Hosty.")

    @Parameter(title: "Event")
    var target: HostEventEntity

    func perform() async throws -> some IntentResult {
        let id = target.id
        await MainActor.run { Router.shared.openHostEvent(id) }
        return .result()
    }
}

/// "Check in a guest with Hosty" — for the door, hands full.
struct CheckInGuestIntent: AppIntent {
    static let title: LocalizedStringResource = "Check In Guest"
    static let description = IntentDescription(
        "Checks a guest in at the door of one of your Hosty events.")

    @Parameter(title: "Guest name")
    var guestName: String

    @Parameter(title: "Event")
    var event: HostEventEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Check in \(\.$guestName) at \(\.$event)")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let client = Session.client()
        let list = try await client.guests(eventID: event.id)
        let matches = list.guests.filter { $0.name.localizedCaseInsensitiveContains(guestName) }
        guard let guest = matches.first(where: { $0.checkedInAt == nil }) ?? matches.first else {
            throw IntentMessage.guestNotFound(guestName)
        }
        if guest.checkedInAt != nil {
            return .result(dialog: "\(guest.name) is already checked in.")
        }
        _ = try await client.setCheckedIn(eventID: event.id, guestID: guest.id, checkedIn: true)
        return .result(dialog: "Checked in \(guest.name). That’s \(list.summary.checkedIn + 1) through the door.")
    }
}

nonisolated struct HostyShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: NextEventIntent(),
            phrases: [
                "What’s my next event in \(.applicationName)",
                "When is my next \(.applicationName) event",
            ],
            shortTitle: "Next Event",
            systemImageName: "calendar")
        AppShortcut(
            intent: CheckInGuestIntent(),
            phrases: [
                "Check in a guest with \(.applicationName)",
                "Check someone in with \(.applicationName)",
            ],
            shortTitle: "Check In Guest",
            systemImageName: "person.crop.circle.badge.checkmark")
        AppShortcut(
            intent: OpenEventIntent(),
            phrases: ["Open \(\.$target) in \(.applicationName)"],
            shortTitle: "Open Event",
            systemImageName: "rectangle.stack")
    }
}
