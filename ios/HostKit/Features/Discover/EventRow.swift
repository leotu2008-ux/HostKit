import SwiftUI

/// One night in a list: when, the title, who and where, cover on the right.
struct EventRow: View {
    let event: HostEvent
    var showsStatus = false

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(EventDates.summary(for: event))
                    .font(.inter(.footnote))
                    .foregroundStyle(.secondary)
                Text(event.title)
                    .font(.event(19))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text([event.hostName.map { "By \($0)" }, Cities.short(event.city)]
                    .compactMap { $0 }.joined(separator: " · "))
                    .font(.inter(.footnote))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if let school = event.school {
                        StatusPill(text: school.short, tint: .accentColor)
                    }
                    if showsStatus {
                        StatusPill(text: event.statusLabel, tint: event.published ? .accentColor : .secondary)
                    }
                    StatusPill(text: "\(event.going) going", tint: .green)
                }
                .padding(.top, 2)
            }
            Spacer(minLength: 0)
            CoverArt(seed: event.id)
                .frame(width: 78, height: 78)
                .clipShape(.rect(cornerRadius: 14))
        }
        .padding(12)
        .background(.background, in: .rect(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(.quaternary))
        .contentShape(.rect(cornerRadius: 18))
    }
}

#Preview {
    EventRow(event: SampleData.events[0], showsStatus: true)
        .padding()
}
