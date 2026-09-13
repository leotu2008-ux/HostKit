import SwiftUI

/// The host's own nights as a timeline, upcoming or past. Works signed out
/// too: drafts made on this phone show here until a sign-in publishes them.
struct MyEventsView: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router

    @State private var events: [HostEvent] = []
    @State private var showPast = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var isSigningIn = false
    @State private var path: [HostEvent] = []

    private var visible: [HostEvent] {
        let filtered = events.filter { EventDates.isPast($0) == showPast }
        return showPast ? filtered.reversed() : filtered
    }

    /// Reload when the account or the set of local drafts changes.
    private var reloadKey: String {
        "\(model.user?.id ?? "-")|\(model.drafts.map(\.id).joined(separator: ","))"
    }

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if model.hasNights {
                    timeline
                } else {
                    ContentUnavailableView {
                        Label("Host your own events", systemImage: "calendar.badge.plus")
                    } description: {
                        Text("Create an event right here — no account needed until you publish it.")
                    } actions: {
                        Button("Create event") { router.startCreate() }
                            .buttonStyle(.prominent)
                        Button("Sign in") { isSigningIn = true }
                    }
                }
            }
            .background { BrandWash() }
            .navigationTitle("Events")
            .navigationDestination(for: HostEvent.self) { event in
                ManageEventView(event: event) { updated in
                    if let index = events.firstIndex(where: { $0.id == updated.id }) {
                        events[index] = updated
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { LogoMark() }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Create event", systemImage: "plus") { router.startCreate() }
                }
            }
            .sheet(isPresented: $isSigningIn) {
                SignInView()
            }
            .task(id: reloadKey) { await load() }
            // Set by Create and by Siri; also handles the tab being opened
            // for the first time with an id already waiting.
            .task(id: router.openEventID) {
                if let id = router.openEventID { await open(id) }
            }
        }
    }

    private var timeline: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Picker("When", selection: $showPast) {
                    Text("Upcoming").tag(false)
                    Text("Past").tag(true)
                }
                .pickerStyle(.segmented)

                if !model.isSignedIn {
                    HStack(spacing: 12) {
                        Image(systemName: "iphone")
                            .foregroundStyle(.secondary)
                        Text("Drafts live on this iPhone. Sign in when you’re ready to publish.")
                            .font(.inter(.footnote))
                            .foregroundStyle(.secondary)
                        Spacer()
                        Button("Sign in") { isSigningIn = true }
                            .font(.inter(.footnote, .semibold))
                    }
                    .padding(12)
                    .background(.quaternary.opacity(0.5), in: .rect(cornerRadius: 12))
                }

                if let errorMessage {
                    NoticeBanner(text: errorMessage)
                }

                if isLoading && events.isEmpty {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else if visible.isEmpty {
                    ContentUnavailableView(
                        showPast ? "No past events" : "No upcoming events",
                        systemImage: "calendar",
                        description: Text(showPast
                            ? "Events you’ve hosted collect here."
                            : "Tap + to create one. You can publish when you’re ready."))
                } else {
                    EventTimeline(events: visible)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 24)
        }
        .refreshable { await load() }
    }

    private func load() async {
        guard model.hasNights else {
            events = []
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            events = try await model.api.myEvents()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func open(_ id: String) async {
        router.openEventID = nil
        if events.first(where: { $0.id == id }) == nil { await load() }
        if let event = events.first(where: { $0.id == id }) {
            path = [event]
        }
    }
}
