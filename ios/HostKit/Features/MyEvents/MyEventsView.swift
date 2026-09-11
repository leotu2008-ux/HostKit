import SwiftUI

/// The host's own nights as a timeline, upcoming or past.
struct MyEventsView: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router

    @State private var events: [HostEvent] = []
    @State private var showPast = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var isCreating = false
    @State private var isSigningIn = false
    @State private var path: [HostEvent] = []

    private var visible: [HostEvent] {
        let filtered = events.filter { EventDates.isPast($0) == showPast }
        return showPast ? filtered.reversed() : filtered
    }

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if model.isSignedIn {
                    timeline
                } else {
                    ContentUnavailableView {
                        Label("Host your own nights", systemImage: "calendar.badge.plus")
                    } description: {
                        Text("Sign in to see the events you host, check guests in, and publish new ones.")
                    } actions: {
                        Button("Sign in") { isSigningIn = true }
                            .buttonStyle(.glassProminent)
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
                if model.isSignedIn {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Create event", systemImage: "plus") { isCreating = true }
                    }
                }
            }
            .sheet(isPresented: $isCreating) {
                CreateEventView { created in
                    events.append(created)
                    events.sort { ($0.startsAt ?? .distantFuture) < ($1.startsAt ?? .distantFuture) }
                    path.append(created)
                }
            }
            .sheet(isPresented: $isSigningIn) {
                SignInView()
            }
            .task(id: model.user?.id) { await load() }
            .onChange(of: router.openEventID) { _, id in
                guard let id else { return }
                Task { await open(id) }
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
                            ? "Nights you’ve hosted collect here."
                            : "Tap + to create one. You can publish when you’re ready."))
                } else {
                    ForEach(DayGroup.group(visible)) { group in
                        HStack(alignment: .top, spacing: 12) {
                            VStack(spacing: 6) {
                                Circle().fill(.secondary).frame(width: 7, height: 7).padding(.top, 7)
                                Rectangle()
                                    .fill(.quaternary)
                                    .frame(width: 1)
                                    .frame(maxHeight: .infinity)
                            }
                            VStack(alignment: .leading, spacing: 10) {
                                HStack(alignment: .firstTextBaseline, spacing: 8) {
                                    Text(group.label).font(.headline)
                                    if let relative = group.relative {
                                        Text(relative).font(.subheadline).foregroundStyle(.secondary)
                                    }
                                }
                                ForEach(group.events) { event in
                                    NavigationLink(value: event) {
                                        EventRow(event: event, showsStatus: true)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 24)
        }
        .refreshable { await load() }
    }

    private func load() async {
        guard model.isSignedIn else {
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
