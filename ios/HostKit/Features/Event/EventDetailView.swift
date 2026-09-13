import SwiftUI

/// The guest-facing page for a night: cover, when and where, register.
struct EventDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @State private var event: HostEvent
    @State private var isRegistering = false
    @State private var calendarAdded: Bool
    /// nil until the club page answered whether the viewer follows it.
    @State private var followsClub: Bool?
    @State private var isFollowBusy = false
    @State private var isSigningIn = false

    init(event: HostEvent) {
        _event = State(initialValue: event)
        _calendarAdded = State(initialValue: Session.calendarEntries[event.id] != nil)
    }

    private func loadFollowState() async {
        guard let club = event.club, followsClub == nil else { return }
        if let page = try? await model.api.club(handle: club.handle) { followsClub = page.club.isFollowing }
    }

    private func toggleFollow(_ handle: String, _ following: Bool) async {
        guard model.isSignedIn else {
            isSigningIn = true
            return
        }
        isFollowBusy = true
        defer { isFollowBusy = false }
        if let updated = try? await model.api.setFollowing(handle: handle, !following) {
            followsClub = updated.isFollowing
        }
    }

    /// Official events have no registration, so the calendar is a button.
    private func addToCalendar() async {
        let link = event.official?.pageURL ?? model.api.webURL(for: event)
        calendarAdded = await CalendarSync.add(event, link: link)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // A photo keeps its own shape (a wide poster stays wide, no
                // crop-and-zoom); only the drawn cover is a square.
                Group {
                    if let url = event.coverURL {
                        CoverPhoto(url: url, seed: event.id)
                    } else {
                        EventCover(event: event)
                            .aspectRatio(1, contentMode: .fit)
                    }
                }
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
                    if let club = event.club {
                        HStack(spacing: 8) {
                            NavigationLink {
                                ClubView(handle: club.handle)
                            } label: {
                                HStack(spacing: 8) {
                                    HostAvatar(name: club.name, imageURL: club.imageURL, size: 24)
                                    Text("Hosted by \(club.name)").font(.inter(.subheadline)).lineLimit(1)
                                    Image(systemName: "chevron.right").font(.inter(.caption)).foregroundStyle(.secondary)
                                }
                            }
                            .buttonStyle(.plain)
                            Spacer(minLength: 0)
                            // Follow right here, where people meet the club.
                            if let following = followsClub {
                                if following {
                                    Button("Following") { Task { await toggleFollow(club.handle, true) } }
                                        .font(.inter(.caption, .semibold))
                                        .buttonStyle(.glass)
                                        .controlSize(.small)
                                        .disabled(isFollowBusy)
                                } else {
                                    Button("Follow") { Task { await toggleFollow(club.handle, false) } }
                                        .font(.inter(.caption, .semibold))
                                        .buttonStyle(.glassProminent)
                                        .controlSize(.small)
                                        .disabled(isFollowBusy)
                                }
                            }
                        }
                    } else if let host = event.hostName {
                        HStack(spacing: 8) {
                            HostAvatar(name: host, size: 24)
                            Text(event.isOfficial ? "By \(host)" : "Hosted by \(host)").font(.inter(.subheadline))
                        }
                    }
                    if event.published && !event.isOfficial {
                        GoingRow(attendees: event.attendees ?? [], total: event.going)
                            .padding(.top, 4)
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
                    if let official = event.official {
                        InfoRow(
                            tile: { IconTile(systemName: "building.columns") },
                            title: official.source,
                            detail: "From the school’s official calendar")
                    } else {
                        InfoRow(
                            tile: { IconTile(systemName: "ticket") },
                            title: event.ticketLabel,
                            detail: "\(event.spotsLeft) of \(event.capacity) spots left")
                    }
                }

                if event.isOfficial, event.startsAt != nil {
                    Button {
                        Task { await addToCalendar() }
                    } label: {
                        Label(calendarAdded ? "In your calendar" : "Add to calendar",
                              systemImage: calendarAdded ? "checkmark.circle.fill" : "calendar.badge.plus")
                            .font(.inter(.subheadline, .semibold))
                    }
                    .buttonStyle(.glass)
                    .disabled(calendarAdded)
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
        .background { AmbientBackground(seed: event.id, coverURL: event.coverURL) }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                ShareLink(item: event.official?.pageURL ?? model.api.webURL(for: event)) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
        .safeAreaInset(edge: .bottom) { registerBar }
        .sheet(isPresented: $isRegistering) {
            RegisterSheet(event: event) { state in
                event.registration = state
                if state == .going { event.going += 1 }
            }
        }
        .sheet(isPresented: $isSigningIn) { SignInView() }
        .task { await refresh() }
        .task(id: event.club?.handle) { await loadFollowState() }
    }

    @ViewBuilder
    private var registerBar: some View {
        if let official = event.official {
            // Official events are the school's: details and sign-up live on its site.
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Official event").font(.inter(.subheadline, .semibold))
                    Text(official.source).font(.inter(.caption)).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer()
                if let url = official.pageURL {
                    Button("Open", systemImage: "arrow.up.right") { openURL(url) }
                        .buttonStyle(.prominent)
                        .controlSize(.large)
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 10)
            .glassEffect(.regular, in: .capsule)
            .padding(.horizontal)
            .padding(.bottom, 4)
        } else if event.published {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(event.going) going").font(.inter(.subheadline, .semibold))
                    Text(event.ticketLabel).font(.inter(.caption)).foregroundStyle(.secondary)
                }
                Spacer()
                switch event.registrationState {
                case .going:
                    Label("You’re in", systemImage: "checkmark.circle.fill")
                        .font(.inter(.subheadline, .semibold))
                        .foregroundStyle(.green)
                case .pending:
                    Label("Requested", systemImage: "clock")
                        .font(.inter(.subheadline, .semibold))
                        .foregroundStyle(.orange)
                case .waitlisted:
                    Label("On the waitlist", systemImage: "person.2.wave.2")
                        .font(.inter(.subheadline, .semibold))
                        .foregroundStyle(.orange)
                case .none:
                    Button(event.requiresApproval ?? false ? "Request to join" : event.isFull ? "Join waitlist" : "Register") {
                        isRegistering = true
                    }
                    .buttonStyle(.prominent)
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
