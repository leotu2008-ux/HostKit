import SwiftUI

/// A compact card for the "Your events" strip: cover on top, when, title,
/// and whether you're hosting or going.
struct EventTile: View {
    let event: HostEvent

    private var role: (text: String, tint: Color) {
        if event.isOwner {
            return event.published ? ("Hosting", .accentColor) : ("Draft", .secondary)
        }
        switch event.registrationState {
        case .pending: return ("Requested", .orange)
        case .waitlisted: return ("Waitlist", .orange)
        default: return ("Going", .green)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            EventCover(event: event)
                .frame(width: 196, height: 118)
                .clipShape(.rect(cornerRadius: 12))
            Text(EventDates.summary(for: event))
                .font(.inter(.caption))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .padding(.top, 4)
            Text(event.title)
                .font(.event(16))
                .foregroundStyle(.primary)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .frame(minHeight: 40, alignment: .top)
            StatusPill(text: role.text, tint: role.tint)
        }
        .frame(width: 196, alignment: .leading)
        .padding(10)
        .background(.background, in: .rect(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(.quaternary))
        .contentShape(.rect(cornerRadius: 18))
    }
}
