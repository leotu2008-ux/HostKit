import Observation

/// App-wide navigation state. A singleton so App Intents (Siri, Shortcuts)
/// can steer the UI — "open my next event" sets `openEventID` and the
/// Events tab pushes it.
@Observable
final class Router {
    static let shared = Router()

    enum Tab: Hashable {
        case discover, events, create
    }

    var tab: Tab = .discover
    /// A host event to open on the Events tab, set by intents and by Create.
    var openEventID: String?
    /// An event you're going to, opened on Discover from a tapped reminder.
    var openGuestEventID: String?

    private init() {}

    func openHostEvent(_ id: String) {
        tab = .events
        openEventID = id
    }

    func openGuestEvent(_ id: String) {
        tab = .discover
        openGuestEventID = id
    }
}
