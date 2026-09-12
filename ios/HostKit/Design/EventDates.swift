import Foundation

/// Formatting for event times.
///
/// The website stores a night's start as the host's wall-clock time encoded
/// as UTC ("7:30 PM" is saved as 19:30Z), and renders it in UTC. Reading it in
/// UTC here keeps every device showing the time the host typed.
nonisolated enum EventDates {
    static let utc = TimeZone(identifier: "UTC")!

    private static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = utc
        return calendar
    }

    private static func style(_ base: Date.FormatStyle) -> Date.FormatStyle {
        var style = base
        style.timeZone = utc
        return style
    }

    /// "Friday, September 18"
    static func longDay(_ date: Date) -> String {
        date.formatted(style(.dateTime.weekday(.wide).month(.wide).day()))
    }

    /// "Fri, Sep 18"
    static func shortDay(_ date: Date) -> String {
        date.formatted(style(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))
    }

    /// "7:30 PM"
    static func time(_ date: Date) -> String {
        date.formatted(style(.dateTime.hour().minute()))
    }

    /// "7:12 PM" in the device's time zone — for real instants like a
    /// check-in, not for event start times.
    static func localTime(_ date: Date) -> String {
        date.formatted(.dateTime.hour().minute())
    }

    /// "SEP"
    static func monthAbbreviation(_ date: Date) -> String {
        date.formatted(style(.dateTime.month(.abbreviated))).uppercased()
    }

    /// "18"
    static func dayNumber(_ date: Date) -> String {
        String(calendar.component(.day, from: date))
    }

    /// "7:30 PM – 11:30 PM"
    static func range(for event: HostEvent) -> String {
        guard let start = event.startsAt else { return "\(event.durationHours) hours" }
        if let official = event.official {
            // The school's calendar: an end only when the feed gave one.
            if official.allDay { return "All day" }
            if let end = official.endsAt { return "\(time(start)) – \(time(end))" }
            return time(start)
        }
        guard let end = event.endsAt else { return "\(event.durationHours) hours" }
        return "\(time(start)) – \(time(end))"
    }

    /// "Fri, Sep 18 · 7:30 PM", "Fri, Sep 18 · All day", or "Date to be announced".
    static func summary(for event: HostEvent) -> String {
        guard let start = event.startsAt else { return "Date to be announced" }
        if event.official?.allDay == true { return "\(shortDay(start)) · All day" }
        return "\(shortDay(start)) · \(time(start))"
    }

    /// Stable key for grouping nights by calendar day.
    static func dayKey(_ date: Date?) -> String {
        guard let date else { return "tba" }
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return "\(parts.year ?? 0)-\(parts.month ?? 0)-\(parts.day ?? 0)"
    }

    /// "Today" / "Tomorrow", or nil further out.
    static func relativeDay(_ date: Date?, now: Date = .now) -> String? {
        guard let date else { return nil }
        let today = wallClockNow(now)
        let days = calendar.dateComponents(
            [.day], from: calendar.startOfDay(for: today), to: calendar.startOfDay(for: date)
        ).day
        switch days {
        case 0: return "Today"
        case 1: return "Tomorrow"
        default: return nil
        }
    }

    static func isPast(_ event: HostEvent, now: Date = .now) -> Bool {
        guard let start = event.startsAt else { return false }
        return calendar.startOfDay(for: start) < calendar.startOfDay(for: wallClockNow(now))
    }

    /// The device's current local time re-expressed in the UTC convention.
    static func wallClockNow(_ now: Date = .now) -> Date {
        now.addingTimeInterval(TimeInterval(TimeZone.current.secondsFromGMT(for: now)))
    }

    /// Converts a date picked in the device's time zone to the stored
    /// convention: same year/month/day/hour/minute, expressed in UTC.
    static func toWallClock(_ localDate: Date) -> Date {
        var local = Calendar(identifier: .gregorian)
        local.timeZone = .current
        let parts = local.dateComponents([.year, .month, .day, .hour, .minute], from: localDate)
        return calendar.date(from: parts) ?? localDate
    }

    /// The inverse of `toWallClock`: the stored 7:30 PM as a real instant in
    /// the phone's time zone, for reminders and calendar entries.
    static func fromWallClock(_ stored: Date) -> Date {
        let parts = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: stored)
        var local = Calendar(identifier: .gregorian)
        local.timeZone = .current
        return local.date(from: parts) ?? stored
    }

    static func wallClock(daysFromNow days: Int, hour: Int, minute: Int) -> Date {
        let base = calendar.startOfDay(for: wallClockNow())
        let day = calendar.date(byAdding: .day, value: days, to: base) ?? base
        return calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day) ?? day
    }
}
