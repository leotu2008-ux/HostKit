import SwiftUI

/// The opening screen: the brand, your events, where to go next, and a
/// taste of what's on nearby. Discover proper is its own tab.
struct HomeView: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router

    @State private var feed = DiscoverFeed(events: [])
    @State private var isLoading = true
    @State private var isSigningIn = false
    @State private var path: [HostEvent] = []

    private var city: String? { Session.city.flatMap { $0.isEmpty ? nil : $0 } }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        let part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
        if let name = model.user?.name.split(separator: " ").first, model.isSignedIn {
            return "\(part), \(name)"
        }
        return "Host the night. Find the next one."
    }

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(greeting).font(.inter(.title2, .semibold))
                        Text(model.isSignedIn
                            ? "Here’s what’s coming up for you, and what’s on around you."
                            : "Student socials, professional mixers, and nights just for fun. Create an event in a minute — no account needed until you publish.")
                            .font(.inter(.subheadline))
                            .foregroundStyle(.secondary)
                    }

                    if let notice = model.sampleNotice {
                        NoticeBanner(text: notice)
                    }

                    YourEventsSection(events: feed.mine, isLoading: isLoading) { isSigningIn = true }

                    if !feed.following.isEmpty {
                        preview(title: "From clubs you follow", events: Array(feed.following.prefix(3)))
                    }

                    quickActions

                    if let school = feed.school, !feed.campus.isEmpty {
                        preview(title: "At \(school.short)", events: Array(feed.campus.prefix(2)))
                    }

                    preview(
                        title: city.map { "Happening around \(Cities.short($0))" } ?? "Happening soon",
                        events: Array(feed.events.prefix(3)))
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
            .background { BrandWash() }
            .navigationTitle("HostKit")
            .navigationDestination(for: HostEvent.self) { event in
                EventDetailView(event: event)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { LogoMark() }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Create event", systemImage: "plus") { router.tab = .create }
                }
            }
            .sheet(isPresented: $isSigningIn) { SignInView() }
            .task(id: "\(city ?? "")|\(model.user?.id ?? "")") { await load() }
            .refreshable { await load() }
        }
    }

    private var quickActions: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Where to next").font(.inter(.title3, .semibold))
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                action("Create an event", "plus.circle.fill", "Publish when ready") { router.tab = .create }
                action("Discover", "sparkles", "Near you and at school") { router.tab = .discover }
                action("My events", "calendar", "Upcoming and past") { router.tab = .events }
                action("Profile", "person.crop.circle", "Photo, phone, settings") { router.tab = .profile }
            }
        }
    }

    private func action(_ title: String, _ symbol: String, _ hint: String, perform: @escaping () -> Void) -> some View {
        Button(action: perform) {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: symbol).font(.inter(size: 20, .semibold)).foregroundStyle(.tint)
                Text(title).font(.inter(.subheadline, .semibold)).foregroundStyle(.primary)
                Text(hint).font(.inter(.caption)).foregroundStyle(.secondary).lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(.background, in: .rect(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(.quaternary))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func preview(title: String, events: [HostEvent]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(title).font(.inter(.title3, .semibold))
                Spacer()
                Button("See all") { router.tab = .discover }
                    .font(.inter(.subheadline, .medium))
            }
            if isLoading && events.isEmpty {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, 20)
            } else if events.isEmpty {
                Text("Nothing listed yet — be the first to publish an event.")
                    .font(.inter(.subheadline))
                    .foregroundStyle(.secondary)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.quaternary.opacity(0.4), in: .rect(cornerRadius: 14))
            } else {
                ForEach(events) { event in
                    NavigationLink(value: event) { EventRow(event: event) }
                        .buttonStyle(.plain)
                }
            }
        }
    }

    private func load() async {
        isLoading = true
        feed = await model.discover(city: city)
        isLoading = false
        await model.syncReminders(with: feed)
    }
}
