import SwiftUI

/// Stacked faces and "Ada, Grace and 12 others are going".
struct GoingRow: View {
    let attendees: [Attendee]
    let total: Int

    var body: some View {
        HStack(spacing: 10) {
            if !attendees.isEmpty {
                HStack(spacing: -8) {
                    ForEach(attendees.prefix(5)) { person in
                        HostAvatar(name: person.firstName, imageURL: person.imageURL, size: 26)
                            .overlay(Circle().strokeBorder(Color(uiColor: .systemBackground), lineWidth: 2))
                    }
                }
            }
            Text(Attendee.sentence(attendees.map(\.firstName), total: total))
                .font(.inter(.subheadline))
                .foregroundStyle(.secondary)
        }
    }
}
