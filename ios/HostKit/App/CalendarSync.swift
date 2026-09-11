import EventKit
import Foundation

/// Puts an event you register for on your calendar. Write-only access: the
/// app can add, and never sees what else is there.
enum CalendarSync {
    private static let store = EKEventStore()

    static func requestPermission() async -> Bool {
        switch EKEventStore.authorizationStatus(for: .event) {
        case .fullAccess, .writeOnly:
            return true
        case .notDetermined:
            return (try? await store.requestWriteOnlyAccessToEvents()) ?? false
        default:
            return false
        }
    }

    static var isAllowed: Bool {
        let status = EKEventStore.authorizationStatus(for: .event)
        return status == .fullAccess || status == .writeOnly
    }

    /// Adds the event once; a second registration for the same night is a no-op.
    @discardableResult
    static func add(_ event: HostEvent, link: URL) async -> Bool {
        guard let start = event.startsAt.map(EventDates.fromWallClock) else { return false }
        if Session.calendarEntries[event.id] != nil { return true }
        guard await requestPermission() else { return false }

        let item = EKEvent(eventStore: store)
        item.title = event.title
        item.startDate = start
        item.endDate = start.addingTimeInterval(TimeInterval(event.durationHours) * 3600)
        item.location = event.address ?? event.city
        item.url = link
        item.notes = [event.description, "Registered with HostKit — \(link.absoluteString)"]
            .compactMap { $0 }.joined(separator: "\n\n")
        item.calendar = store.defaultCalendarForNewEvents
        item.addAlarm(EKAlarm(relativeOffset: -3600))
        do {
            try store.save(item, span: .thisEvent, commit: true)
            var entries = Session.calendarEntries
            entries[event.id] = item.eventIdentifier ?? "saved"
            Session.calendarEntries = entries
            return true
        } catch {
            return false
        }
    }
}
