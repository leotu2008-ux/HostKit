import PhotosUI
import SwiftUI

/// The host's side of one night: who's coming and the door (Overview),
/// who to reach (Outreach), emailing the guest list (Blasts), and getting
/// the word out (Promote).
struct ManageEventView: View {
    enum Tab: String, CaseIterable, Identifiable {
        case overview = "Overview"
        case outreach = "Outreach"
        case blasts = "Blasts"
        case promote = "Promote"
        var id: String { rawValue }
    }

    @Environment(AppModel.self) private var model
    @State private var event: HostEvent
    @State private var tab: Tab = .overview
    @State private var isSigningIn = false
    @State private var isPublishing = false
    @State private var errorMessage: String?
    @State private var isPickingCover = false
    @State private var coverItem: PhotosPickerItem?
    @State private var isSavingCover = false

    let onChange: (HostEvent) -> Void

    init(event: HostEvent, onChange: @escaping (HostEvent) -> Void) {
        _event = State(initialValue: event)
        self.onChange = onChange
    }

    var body: some View {
        VStack(spacing: 0) {
            header
                .padding(.horizontal)
                .padding(.top, 8)
            Picker("Section", selection: $tab) {
                ForEach(Tab.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.vertical, 10)

            if let errorMessage {
                Text(errorMessage)
                    .font(.inter(.footnote))
                    .foregroundStyle(.red)
                    .padding(.horizontal)
            }

            switch tab {
            case .overview:
                OverviewTab(event: event)
            case .outreach:
                OutreachTab(event: event)
            case .blasts:
                BlastsTab(event: event)
            case .promote:
                PromoteTab(event: $event, onChange: onChange, requestSignIn: { isSigningIn = true })
            }
        }
        .background { AmbientBackground(seed: event.id, coverURL: event.coverURL) }
        .navigationTitle(event.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                ShareLink(item: model.api.webURL(for: event)) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
        // Publishing asked for a sign-in; once that's done, finish the job.
        .sheet(isPresented: $isSigningIn, onDismiss: {
            if model.isSignedIn && !event.published {
                Task { await publish() }
            }
        }) {
            SignInView()
        }
        .photosPicker(isPresented: $isPickingCover, selection: $coverItem, matching: .images)
        .onChange(of: coverItem) { _, item in
            guard let item else { return }
            Task { await setCover(item) }
        }
    }

    private var header: some View {
        HStack(spacing: 14) {
            // Tap the cover to swap in a photo.
            Menu {
                Button("Choose photo", systemImage: "photo") { isPickingCover = true }
                if event.coverURL != nil {
                    Button("Remove photo", systemImage: "trash", role: .destructive) {
                        Task { await removeCover() }
                    }
                }
            } label: {
                EventCover(event: event)
                    .frame(width: 64, height: 64)
                    .clipShape(.rect(cornerRadius: 14))
                    .overlay(alignment: .bottomTrailing) {
                        Group {
                            if isSavingCover {
                                ProgressView().controlSize(.mini)
                            } else {
                                Image(systemName: "camera.fill").font(.inter(size: 9, .bold))
                            }
                        }
                        .frame(width: 20, height: 20)
                        .background(.regularMaterial, in: .circle)
                        .padding(3)
                    }
            }
            .buttonStyle(.plain)
            .disabled(isSavingCover)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    StatusPill(
                        text: event.statusLabel,
                        tint: event.published ? .accentColor : .secondary)
                    if let school = event.school {
                        StatusPill(text: school.short, tint: .brand)
                    }
                }
                Text(event.title).font(.event(22)).lineLimit(2)
                Text(EventDates.summary(for: event))
                    .font(.inter(.subheadline)).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            if !event.published {
                Button {
                    Task { await publish() }
                } label: {
                    Text(model.isSignedIn ? "Publish" : "Sign in")
                }
                .buttonStyle(.prominent)
                .disabled(isPublishing)
            }
        }
    }

    private func setCover(_ item: PhotosPickerItem) async {
        isSavingCover = true
        defer {
            isSavingCover = false
            coverItem = nil
        }
        do {
            guard let jpeg = try await PhotoJPEG.data(from: item) else {
                errorMessage = "Couldn't read that photo."
                return
            }
            event = try await model.api.setCover(eventID: event.id, jpeg, contentType: PhotoJPEG.contentType)
            onChange(event)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func removeCover() async {
        isSavingCover = true
        defer { isSavingCover = false }
        do {
            event = try await model.api.removeCover(eventID: event.id)
            onChange(event)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func publish() async {
        guard model.isSignedIn else {
            isSigningIn = true
            return
        }
        isPublishing = true
        defer { isPublishing = false }
        do {
            event = try await model.setPublished(event, true)
            onChange(event)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Overview: counts, guests, check-in

private struct OverviewTab: View {
    @Environment(AppModel.self) private var model
    let event: HostEvent

    @State private var guests: [Guest] = []
    @State private var summary: GuestSummary?
    @State private var search = ""
    @State private var busyGuestID: String?
    @State private var errorMessage: String?

    private var requests: [Guest] { guests.filter { $0.status == .pending } }
    private var waitlist: [Guest] { guests.filter { $0.status == .waitlisted } }

    private var filtered: [Guest] {
        let query = search.trimmingCharacters(in: .whitespaces)
        let listed = guests.filter { $0.status != .pending && $0.status != .waitlisted }
        guard !query.isEmpty else { return listed }
        return listed.filter {
            $0.name.localizedCaseInsensitiveContains(query)
                || ($0.email?.localizedCaseInsensitiveContains(query) ?? false)
        }
    }

    private func decide(_ guest: Guest, approve: Bool) async {
        busyGuestID = guest.id
        defer { busyGuestID = nil }
        do {
            _ = try await model.api.setGuestStatus(
                eventID: event.id, guestID: guest.id, status: approve ? .attending : .declined)
            // A decision can move the line; reload rather than patch.
            await loadGuests()
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    var body: some View {
        List {
            Section {
                HStack(spacing: 10) {
                    stat("Going", summary?.going ?? event.going)
                    stat("Checked in", summary?.checkedIn ?? 0)
                    if requests.count + waitlist.count > 0 {
                        stat("Waiting", requests.count + waitlist.count)
                    } else {
                        stat("Capacity", event.capacity)
                    }
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            if let errorMessage {
                Section { Text(errorMessage).foregroundStyle(.red) }
            }

            if !requests.isEmpty {
                Section {
                    ForEach(requests) { guest in
                        HStack(spacing: 12) {
                            HostAvatar(name: guest.name, size: 34)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(guest.name).font(.inter(.body, .medium))
                                Text(guest.email ?? "No email").font(.inter(.caption)).foregroundStyle(.secondary).lineLimit(1)
                            }
                            Spacer()
                            Button("Decline") { Task { await decide(guest, approve: false) } }
                                .buttonStyle(.bordered).tint(.secondary)
                            Button("Approve") { Task { await decide(guest, approve: true) } }
                                .buttonStyle(.borderedProminent)
                        }
                        .disabled(busyGuestID != nil)
                        .font(.inter(.footnote, .semibold))
                    }
                } header: {
                    Text("Requests")
                } footer: {
                    Text("Approving into a full night puts them on the waitlist.")
                }
            }

            if !waitlist.isEmpty {
                Section {
                    ForEach(Array(waitlist.enumerated()), id: \.element.id) { index, guest in
                        HStack(spacing: 12) {
                            Text("\(index + 1)").font(.inter(.subheadline)).foregroundStyle(.secondary).frame(width: 22)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(guest.name).font(.inter(.body, .medium))
                                Text(guest.email ?? "No email").font(.inter(.caption)).foregroundStyle(.secondary).lineLimit(1)
                            }
                            Spacer()
                            Button("Let in") { Task { await decide(guest, approve: true) } }
                                .buttonStyle(.bordered)
                                .font(.inter(.footnote, .semibold))
                        }
                        .disabled(busyGuestID != nil)
                    }
                } header: {
                    Text("Waitlist")
                } footer: {
                    Text("Oldest first. They move up automatically when a spot opens.")
                }
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
        .searchable(text: $search, prompt: "Find a guest")
        .task { await loadGuests() }
        .refreshable { await loadGuests() }
    }

    private func stat(_ label: String, _ value: Int) -> some View {
        VStack(spacing: 2) {
            Text(value, format: .number).font(.inter(.title2, .semibold)).monospacedDigit()
            Text(label).font(.inter(.caption)).foregroundStyle(.secondary)
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
                Text(guest.name).font(.inter(.body, .medium))
                Text(isIn
                    ? "In at \(EventDates.localTime(guest.checkedInAt!))"
                    : [guest.status.label, guest.email, guest.phone.map(PhoneFormat.pretty)]
                        .compactMap { $0 }.joined(separator: " · "))
                    .font(.inter(.caption))
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
            if let phone = guest.phone, let url = URL(string: "sms:\(phone)") {
                Link(destination: url) { Label("Text", systemImage: "message") }.tint(.green)
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
}
