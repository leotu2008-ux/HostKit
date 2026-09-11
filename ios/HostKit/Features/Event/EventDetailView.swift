import SwiftUI

/// The guest-facing page for a night: cover, when and where, register.
struct EventDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @State private var event: HostEvent
    @State private var isRegistering = false
    @State private var didRegister = false

    init(event: HostEvent) {
        _event = State(initialValue: event)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                CoverArt(seed: event.id)
                    .aspectRatio(1, contentMode: .fit)
                    .clipShape(.rect(cornerRadius: 24))
                    .shadow(color: .black.opacity(0.25), radius: 30, y: 18)
                    .padding(.horizontal, 24)

                VStack(alignment: .leading, spacing: 8) {
                    Text([
                        event.published ? event.typeLabel : "Draft preview · \(event.typeLabel)",
                        event.school?.name,
                    ].compactMap { $0 }.joined(separator: " · "))
                        .font(.inter(.subheadline, .medium))
                        .foregroundStyle(.secondary)
                    Text(event.title)
                        .font(.event(34))
                        .fixedSize(horizontal: false, vertical: true)
                    if let host = event.hostName {
                        HStack(spacing: 8) {
                            HostAvatar(name: host, size: 24)
                            Text("Hosted by \(host)").font(.inter(.subheadline))
                        }
                    }
                }

                VStack(spacing: 14) {
                    InfoRow(
                        tile: { DateTile(date: event.startsAt) },
                        title: event.startsAt.map(EventDates.longDay) ?? "Date to be announced",
                        detail: EventDates.range(for: event))
                    Button {
                        openInMaps()
                    } label: {
                        InfoRow(
                            tile: { IconTile(systemName: "mappin.and.ellipse") },
                            title: event.place,
                            detail: event.address == nil ? nil : event.city)
                    }
                    .buttonStyle(.plain)
                    InfoRow(
                        tile: { IconTile(systemName: "ticket") },
                        title: event.ticketLabel,
                        detail: "\(event.spotsLeft) of \(event.capacity) spots left")
                }

                if let description = event.description, !description.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("About this event").font(.inter(.headline, .semibold))
                        Divider()
                        Text(description)
                            .font(.inter(.body))
                            .lineSpacing(3)
                    }
                }
            }
            .padding()
            .padding(.bottom, 80)
        }
        .background { AmbientBackground(seed: event.id) }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                ShareLink(item: model.api.webURL(for: event)) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
        .safeAreaInset(edge: .bottom) { registerBar }
        .sheet(isPresented: $isRegistering) {
            RegisterSheet(event: event) {
                didRegister = true
                event.going += 1
            }
        }
        .task { await refresh() }
    }

    @ViewBuilder
    private var registerBar: some View {
        if event.published {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(event.going) going").font(.inter(.subheadline, .semibold))
                    Text(event.ticketLabel).font(.inter(.caption)).foregroundStyle(.secondary)
                }
                Spacer()
                if didRegister || event.isRegistered {
                    Label("You’re in", systemImage: "checkmark.circle.fill")
                        .font(.inter(.subheadline, .semibold))
                        .foregroundStyle(.green)
                } else if event.isFull {
                    Text("Full").font(.inter(.subheadline, .semibold)).foregroundStyle(.secondary)
                } else {
                    Button("Register") { isRegistering = true }
                        .buttonStyle(.glassProminent)
                        .controlSize(.large)
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 10)
            .glassEffect(.regular, in: .capsule)
            .padding(.horizontal)
            .padding(.bottom, 4)
        }
    }

    private func refresh() async {
        if let fresh = try? await model.event(id: event.id) {
            event = fresh
        }
    }

    private func openInMaps() {
        let query = event.address.map { "\($0), \(event.city)" } ?? event.city
        guard let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "maps://?q=\(encoded)")
        else { return }
        openURL(url)
    }
}

#Preview {
    NavigationStack {
        EventDetailView(event: SampleData.events[0])
    }
    .environment(AppModel())
}
