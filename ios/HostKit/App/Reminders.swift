import Foundation
import UserNotifications

/// Reminders for events you're going to: the evening before, and an hour
/// out. Scheduled on the phone when you register and re-synced from "Your
/// events" on every Discover load, so a moved date moves the reminder — no
/// server push needed.
enum Reminders {
    private static let prefix = "hostkit-event-"

    /// Asks once; later calls just report the current setting.
    static func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        center.delegate = ForegroundBanners.shared
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return true
        case .notDetermined:
            return (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        default:
            return false
        }
    }

    static func isAllowed() async -> Bool {
        let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        return status == .authorized || status == .provisional || status == .ephemeral
    }

    /// Two reminders, only those still in the future.
    static func schedule(for event: HostEvent) async {
        guard let start = event.startsAt.map(EventDates.fromWallClock) else { return }
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: identifiers(for: event.id))

        let place = event.address ?? Cities.short(event.city)
        var eveningBefore = Calendar.current.date(byAdding: .day, value: -1, to: start) ?? start
        eveningBefore = Calendar.current.date(bySettingHour: 18, minute: 0, second: 0, of: eveningBefore) ?? eveningBefore
        let hourBefore = start.addingTimeInterval(-3600)

        let plans: [(String, String, String, Date)] = [
            (identifiers(for: event.id)[0], "Tomorrow: \(event.title)",
             "\(EventDates.time(event.startsAt!)) · \(place)", eveningBefore),
            (identifiers(for: event.id)[1], "\(event.title) starts in an hour",
             place, hourBefore),
        ]
        for (id, title, body, fireAt) in plans where fireAt > .now {
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = .default
            content.userInfo = ["eventID": event.id]
            let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: fireAt)
            let trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
            try? await center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
        }
    }

    static func cancel(eventID: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: identifiers(for: eventID))
    }

    static func cancelAll() async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(prefix) }
        center.removePendingNotificationRequests(withIdentifiers: pending)
    }

    /// Makes the pending reminders match the events you're going to.
    static func sync(going events: [HostEvent]) async {
        let center = UNUserNotificationCenter.current()
        let wanted = Set(events.flatMap { identifiers(for: $0.id) })
        let stale = await center.pendingNotificationRequests()
            .map(\.identifier)
            .filter { $0.hasPrefix(prefix) && !wanted.contains($0) }
        center.removePendingNotificationRequests(withIdentifiers: stale)
        for event in events {
            await schedule(for: event)
        }
    }

    private static func identifiers(for eventID: String) -> [String] {
        ["\(prefix)\(eventID)-evening", "\(prefix)\(eventID)-hour"]
    }
}

/// Shows reminders as banners even while the app is open, and opens the
/// event when one is tapped.
final class ForegroundBanners: NSObject, UNUserNotificationCenterDelegate {
    static let shared = ForegroundBanners()

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        // Local reminders carry `eventID`; server pushes carry `eventId`.
        let info = response.notification.request.content.userInfo
        if let id = (info["eventID"] ?? info["eventId"]) as? String {
            await MainActor.run { Router.shared.openGuestEvent(id) }
        }
    }
}
