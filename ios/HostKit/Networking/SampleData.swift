import Foundation

/// Nights shown when the server can't be reached, and in SwiftUI previews.
/// Mirrors the demo nights in `prisma/seed.ts`.
nonisolated enum SampleData {
    static let events: [HostEvent] = [
        make(
            id: "sample-rooftop-jazz", title: "Rooftop Jazz Night", type: .launchParty,
            city: "New York, NY", address: "The Lantern Roof, 12 W 29th St", days: 3, hour: 19, minute: 30,
            hours: 4, capacity: 90, going: 74, host: "Maya Chen",
            description: "Warm lights, a quartet, and the city as the backdrop. Doors at 7:15, first set at 7:45. Two drink tickets with registration."),
        make(
            id: "sample-harvest-supper", title: "Harvest Supper", type: .dinnerParty,
            city: "Austin, TX", address: "Pecan Grove Ranch, Dripping Springs", days: 9, hour: 18, minute: 0,
            hours: 4, capacity: 36, going: 21, host: "Maya Chen",
            description: "Long tables, seasonal plates, no speeches. Bring a layer — the barn cools down after dark."),
        make(
            id: "sample-study-social", title: "End-of-Term Social", type: .birthday,
            city: "Los Angeles, CA", address: "Silver Lake Studio 9", days: 12, hour: 20, minute: 0,
            hours: 4, capacity: 60, going: 60, host: "Priya Shah",
            description: "Exams are done. Pizza, a playlist you can argue with, and the roof terrace if the weather holds."),
        make(
            id: "sample-founders-mixer", title: "Founders & Friends Mixer", type: .corporateOffsite,
            city: "New York, NY", address: "Grand Street Loft, SoHo", days: 16, hour: 18, minute: 30,
            hours: 3, capacity: 120, going: 63, host: "Jordan Blake",
            description: "Short demos, long conversations. Snacks by Two Doors Catering."),
    ]

    private static func make(
        id: String, title: String, type: EventKind, city: String, address: String,
        days: Int, hour: Int, minute: Int, hours: Int, capacity: Int, going: Int,
        host: String, description: String
    ) -> HostEvent {
        HostEvent(
            id: id, title: title, type: type, typeLabel: type.label, description: description,
            city: city, address: address, lat: nil, lng: nil,
            startsAt: EventDates.wallClock(daysFromNow: days, hour: hour, minute: minute),
            durationHours: hours, capacity: capacity, going: going,
            ticketType: .free, ticketPriceCents: 0, visibility: .public, published: true,
            hostName: host, school: nil, isOwner: false, webPath: "/e/\(id)")
    }
}
