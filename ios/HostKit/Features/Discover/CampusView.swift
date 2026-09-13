import SwiftUI

/// Everything on the school's official calendar, by day. Official events
/// open on the school's own site; the feeds are credited at the bottom.
struct CampusView: View {
    @Environment(AppModel.self) private var model
    @State private var feed = CampusFeed()
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                if let school = feed.school {
                    Text("What \(school.name) itself has on, refreshed a few times a day.")
                        .font(.inter(.subheadline))
                        .foregroundStyle(.secondary)
                }

                if isLoading && feed.events.isEmpty {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else if let error {
                    ContentUnavailableView("Couldn’t load", systemImage: "wifi.exclamationmark", description: Text(error))
                } else if feed.school == nil {
                    ContentUnavailableView(
                        "Which school are you at?",
                        systemImage: "graduationcap",
                        description: Text("Pick it in Settings — official events follow you everywhere."))
                } else if feed.events.isEmpty {
                    ContentUnavailableView(
                        feed.sources.isEmpty ? "No official feed yet" : "Syncing…",
                        systemImage: "calendar.badge.clock",
                        description: Text(feed.sources.isEmpty
                            ? "We haven’t found a public calendar for this school. Student-hosted nights still show on Discover."
                            : "The first sync runs in the background — pull to refresh in a moment."))
                } else {
                    ForEach(DayGroup.group(feed.events)) { group in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text(group.label).font(.inter(.headline, .semibold))
                                if let relative = group.relative {
                                    Text(relative).font(.inter(.subheadline)).foregroundStyle(.secondary)
                                }
                            }
                            ForEach(group.events) { event in
                                NavigationLink(value: event) { EventRow(event: event) }
                                    .buttonStyle(.plain)
                            }
                        }
                    }
                }

                if !feed.sources.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Sources").font(.inter(.footnote, .semibold)).foregroundStyle(.secondary)
                        ForEach(feed.sources) { source in
                            if let url = URL(string: source.url) {
                                Link(source.name, destination: url).font(.inter(.footnote))
                            } else {
                                Text(source.name).font(.inter(.footnote))
                            }
                        }
                        if let at = feed.syncedAt {
                            Text("Synced \(at.formatted(date: .abbreviated, time: .shortened))")
                                .font(.inter(.caption))
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.top, 8)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 24)
        }
        .background { BrandWash() }
        .navigationTitle(feed.school.map { "On campus at \($0.short)" } ?? "Campus events")
        .navigationBarTitleDisplayMode(.inline)
        // Event pages come from Discover's stack, which pushes this screen;
        // declaring the destination again here would shadow it.
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            feed = try await model.api.campus()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

#Preview {
    NavigationStack { CampusView() }
        .environment(AppModel())
}
