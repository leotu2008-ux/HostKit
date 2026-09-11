import SwiftUI

/// The host's side of one night: publish it, see who's coming, and check
/// people in at the door.
struct ManageEventView: View {
    @Environment(AppModel.self) private var model
    @State private var event: HostEvent
    @State private var guests: [Guest] = []
    @State private var summary: GuestSummary?
    @State private var search = ""
    @State private var errorMessage: String?
    @State private var busyGuestID: String?
    @State private var isPublishing = false
    @State private var isSigningIn = false

    let onChange: (HostEvent) -> Void

    init(event: HostEvent, onChange: @escaping (HostEvent) -> Void) {
        _event = State(initialValue: event)
        self.onChange = onChange
    }

    private var filtered: [Guest] {
        let query = search.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return guests }
        return guests.filter {
            $0.name.localizedCaseInsensitiveContains(query)
                || ($0.email?.localizedCaseInsensitiveContains(query) ?? false)
        }
    }

    var body: some View {
        List {
            Section {
                header
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }

            Section {
                HStack(spacing: 10) {
                    stat("Going", summary?.going ?? event.going)
                    stat("Checked in", summary?.checkedIn ?? 0)
                    stat("Capacity", event.capacity)
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            if let errorMessage {
                Section { Text(errorMessage).foregroundStyle(.red) }
            }

            Section {
                if guests.isEmpty {
                    Text(event.published
                        ? "No one yet. Share the event page to get registrations."
                        : "Publish the event so guests can register.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(filtered) { guest in
                        guestRow(guest)
                    }
                }
            } header: {
                Text("Guests")
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background { AmbientBackground(seed: event.id) }
        .searchable(text: $search, prompt: "Find a guest")
        .navigationTitle(event.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                ShareLink(item: model.api.webURL(for: event)) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
        .task { await loadGuests() }
        .refreshable { await loadGuests() }
        // Publishing asked for a sign-in; once that's done, finish the job.
        .sheet(isPresented: $isSigningIn, onDismiss: {
            if model.isSignedIn && !event.published {
                Task { await togglePublished() }
            }
        }) {
            SignInView()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
                CoverArt(seed: event.id)
                    .frame(width: 72, height: 72)
                    .clipShape(.rect(cornerRadius: 16))
                VStack(alignment: .leading, spacing: 4) {
                    StatusPill(
                        text: event.statusLabel,
                        tint: event.published ? .accentColor : .secondary)
                    Text(event.title).font(.event(24)).lineLimit(2)
                    Text(EventDates.summary(for: event))
                        .font(.subheadline).foregroundStyle(.secondary)
                }
            }
            HStack(spacing: 10) {
                NavigationLink {
                    EventDetailView(event: event)
                } label: {
                    Label("Event page", systemImage: "eye")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.glass)

                Button {
                    Task { await togglePublished() }
                } label: {
                    Label(
                        event.published ? "Unpublish" : model.isSignedIn ? "Publish" : "Sign in to publish",
                        systemImage: event.published ? "eye.slash" : "paperplane.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(event.published ? AnyPrimitiveButtonStyle(.glass) : AnyPrimitiveButtonStyle(.glassProminent))
                .disabled(isPublishing)
            }
            .controlSize(.large)
        }
        .padding(.vertical, 8)
    }

    private func stat(_ label: String, _ value: Int) -> some View {
        VStack(spacing: 2) {
            Text(value, format: .number).font(.title2.weight(.semibold)).monospacedDigit()
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(.background, in: .rect(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(.quaternary))
    }

    private func guestRow(_ guest: Guest) -> some View {
        let isIn = guest.checkedInAt != nil
        return HStack(spacing: 12) {
            HostAvatar(name: guest.name, size: 34)
            VStack(alignment: .leading, spacing: 2) {
                Text(guest.name).font(.body.weight(.medium))
                Text(isIn
                    ? "In at \(EventDates.localTime(guest.checkedInAt!))"
                    : [guest.status.label, guest.email].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            if guest.status != .declined || isIn {
                Button {
                    Task { await setCheckedIn(guest, !isIn) }
                } label: {
                    if busyGuestID == guest.id {
                        ProgressView()
                    } else {
                        Text(isIn ? "In" : "Check in")
                    }
                }
                .buttonStyle(.bordered)
                .tint(isIn ? .green : .accentColor)
                .disabled(busyGuestID != nil)
            }
        }
        .swipeActions {
            if isIn {
                Button("Undo") { Task { await setCheckedIn(guest, false) } }.tint(.orange)
            }
        }
    }

    private func loadGuests() async {
        do {
            let result = try await model.api.guests(eventID: event.id)
            guests = result.guests
            summary = result.summary
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func setCheckedIn(_ guest: Guest, _ checkedIn: Bool) async {
        busyGuestID = guest.id
        defer { busyGuestID = nil }
        do {
            let updated = try await model.api.setCheckedIn(
                eventID: event.id, guestID: guest.id, checkedIn: checkedIn)
            if let index = guests.firstIndex(where: { $0.id == guest.id }) {
                guests[index] = updated
            }
            summary?.checkedIn += checkedIn ? 1 : -1
            if checkedIn {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func togglePublished() async {
        // Publishing is the one step that needs an account.
        guard model.isSignedIn else {
            isSigningIn = true
            return
        }
        isPublishing = true
        defer { isPublishing = false }
        do {
            event = try await model.setPublished(event, !event.published)
            onChange(event)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// Lets one button switch between two different primitive button styles.
struct AnyPrimitiveButtonStyle: PrimitiveButtonStyle {
    private let make: (Configuration) -> AnyView

    init<S: PrimitiveButtonStyle>(_ style: S) {
        make = { AnyView(style.makeBody(configuration: $0)) }
    }

    func makeBody(configuration: Configuration) -> some View {
        make(configuration)
    }
}
