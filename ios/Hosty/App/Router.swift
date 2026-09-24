import Foundation
import Observation

/// App-wide navigation state. A singleton so App Intents (Siri, Shortcuts)
/// can steer the UI — "open my next event" sets `openEventID` and the
/// Events tab pushes it.
@Observable
final class Router {
    static let shared = Router()

    enum Tab: Hashable {
        case home, discover, events, profile
    }

    var tab: Tab = .home
    /// The Create form, presented as a sheet over whatever tab is showing.
    var isCreating = false
    /// A host event to open on the Events tab, set by intents and by Create.
    var openEventID: String?
    /// An event you're going to, opened on Discover from a tapped reminder.
    var openGuestEventID: String?

    private init() {
        // Debug hook: `xcrun simctl launch … app.hostkit.ios -hosty-tab discover`
        // opens straight onto a tab, for screenshots without tapping.
        switch UserDefaults.standard.string(forKey: "hosty-tab") {
        case "discover": tab = .discover
        case "events": tab = .events
        case "create": isCreating = true
        case "profile": tab = .profile
        default: break
        }
        // `… -hosty-event <id>` lands on that event's page.
        if let id = UserDefaults.standard.string(forKey: "hosty-event") {
            openGuestEvent(id)
        }
    }

    func startCreate() {
        isCreating = true
    }

    func openHostEvent(_ id: String) {
        tab = .events
        openEventID = id
    }

    func openGuestEvent(_ id: String) {
        tab = .discover
        openGuestEventID = id
    }
}
