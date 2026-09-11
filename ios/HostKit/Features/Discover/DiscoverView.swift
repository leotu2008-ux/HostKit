import SwiftUI

/// Everything public and upcoming: your campus first, then the city.
struct DiscoverView: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router
    /// nil = Everywhere. Starts from the saved choice, then detection or the
    /// student's home city fills it in.
    @State private var city: String? = Session.city.map { $0.isEmpty ? nil : $0 } ?? nil
    @State private var hasSettledCity = Session.city != nil
    @State private var feed = DiscoverFeed(events: [])
    @State private var isLoading = true
    @State private var path: [HostEvent] = []

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Text("Student socials, professional mixers, and nights just for fun. Register in a tap.")
                        .font(.inter(.subheadline))
                        .foregroundStyle(.secondary)

                    if let notice = model.sampleNotice {
                        NoticeBanner(text: notice)
                    }

                    if let school = feed.school {
                        campusSection(school)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text(city.map { "Around \(Cities.short($0))" } ?? "Everywhere")
                            .font(.inter(.title3, .semibold))
                        cityPicker
                    }

                    if isLoading && feed.events.isEmpty {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                    } else if feed.events.isEmpty {
                        ContentUnavailableView(
                            "Nothing listed yet",
                            systemImage: "calendar.badge.plus",
                            description: Text("Be the first — create an event and publish it."))
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
                                    NavigationLink(value: event) {
                                        EventRow(event: event)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
            .background { BrandWash() }
            .navigationTitle(feed.school.map { "At \($0.short)" } ?? "Discover")
            .navigationDestination(for: HostEvent.self) { event in
                EventDetailView(event: event)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { LogoMark() }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Create event", systemImage: "plus") { router.tab = .create }
                }
            }
            .task(id: "\(city ?? "")|\(model.user?.id ?? "")") { await load() }
            .task { await settleCity() }
            // A tapped reminder lands here with the event to open.
            .task(id: router.openGuestEventID) {
                guard let id = router.openGuestEventID else { return }
                router.openGuestEventID = nil
                if let event = try? await model.event(id: id) { path = [event] }
            }
            .refreshable { await load() }
        }
    }

    @ViewBuilder
    private func campusSection(_ school: School) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("At \(school.short)").font(.inter(.title3, .semibold))
                Text("Nights hosted by \(school.name) students. Everyone’s welcome.")
                    .font(.inter(.footnote))
                    .foregroundStyle(.secondary)
            }
            if feed.campus.isEmpty {
                Text("Nothing at \(school.short) yet — host the first one. Your events are tagged with your school automatically.")
                    .font(.inter(.subheadline))
                    .foregroundStyle(.secondary)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.quaternary.opacity(0.4), in: .rect(cornerRadius: 14))
            } else {
                ForEach(feed.campus) { event in
                    NavigationLink(value: event) {
                        EventRow(event: event)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var cityPicker: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach([nil] + Cities.all.map(Optional.some), id: \.self) { option in
                    let selected = option == city
                    Button {
                        city = option
                        hasSettledCity = true
                        Session.city = option ?? ""
                    } label: {
                        Text(option.map(Cities.short) ?? "Everywhere")
                            .font(.inter(.subheadline, .medium))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .foregroundStyle(selected ? Color(uiColor: .systemBackground) : .primary)
                            .background(selected ? Color.primary : Color.clear, in: .capsule)
                            .overlay(Capsule().strokeBorder(selected ? .clear : Color.secondary.opacity(0.3)))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
        }
        .scrollIndicators(.hidden)
    }

    /// First launch: ask where the phone is; fall back to the student's home
    /// city. Either way, remember it so we don't ask again.
    private func settleCity() async {
        guard !hasSettledCity else { return }
        let detected = await LocationFinder.currentCity() ?? model.user?.school?.city
        hasSettledCity = true
        if let detected {
            city = detected
            Session.city = detected
        }
    }

    private func load() async {
        isLoading = true
        feed = await model.discover(city: city)
        isLoading = false
        await model.syncReminders(with: feed)
    }
}

#Preview {
    DiscoverView()
        .environment(AppModel())
        .environment(Router.shared)
}
