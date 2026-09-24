import SwiftUI

/// A host's nights down a dotted line, grouped by day. Rows are
/// `NavigationLink(value:)`s, so the enclosing stack decides where they go.
struct EventTimeline: View {
    let events: [HostEvent]

    var body: some View {
        ForEach(DayGroup.group(events)) { group in
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
                        Text(group.label).font(.inter(.headline, .semibold))
                        if let relative = group.relative {
                            Text(relative).font(.inter(.subheadline)).foregroundStyle(.secondary)
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

/// Everything already hosted, most recent first. Lives in the account menu.
struct PastEventsView: View {
    @Environment(AppModel.self) private var model
    @State private var events: [HostEvent] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    private var past: [HostEvent] {
        events.filter { EventDates.isPast($0) }.reversed()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let errorMessage {
                    NoticeBanner(text: errorMessage)
                }
                if isLoading && events.isEmpty {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else if past.isEmpty {
                    ContentUnavailableView(
                        "No past events",
                        systemImage: "clock.arrow.circlepath",
                        description: Text("Events you’ve hosted collect here once they’re over."))
                } else {
                    EventTimeline(events: past)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 24)
        }
        .background { BrandWash() }
        .navigationTitle("Past events")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            events = try await model.api.myEvents()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
