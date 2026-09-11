import SwiftUI

struct DiscoverView: View {
    @Environment(AppModel.self) private var model
    @State private var city: String?
    @State private var events: [HostEvent] = []
    @State private var isLoading = true
    @State private var isCreating = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Text("Student socials, professional mixers, and nights just for fun. Register in a tap.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    cityPicker

                    if let notice = model.sampleNotice {
                        NoticeBanner(text: notice)
                    }

                    if isLoading && events.isEmpty {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                    } else if events.isEmpty {
                        ContentUnavailableView(
                            "Nothing listed yet",
                            systemImage: "calendar.badge.plus",
                            description: Text("Be the first — create a night and publish it."))
                    } else {
                        ForEach(DayGroup.group(events)) { group in
                            VStack(alignment: .leading, spacing: 10) {
                                HStack(alignment: .firstTextBaseline, spacing: 8) {
                                    Text(group.label).font(.headline)
                                    if let relative = group.relative {
                                        Text(relative).font(.subheadline).foregroundStyle(.secondary)
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
            .navigationTitle("Discover")
            .navigationDestination(for: HostEvent.self) { event in
                EventDetailView(event: event)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Create event", systemImage: "plus") { isCreating = true }
                }
            }
            .sheet(isPresented: $isCreating) {
                CreateEventView()
            }
            .task(id: city) { await load() }
            .refreshable { await load() }
        }
    }

    private var cityPicker: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach([nil] + Cities.all.map(Optional.some), id: \.self) { option in
                    let selected = option == city
                    Button {
                        city = option
                    } label: {
                        Text(option.map(Cities.short) ?? "Everywhere")
                            .font(.subheadline.weight(.medium))
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

    private func load() async {
        isLoading = true
        events = await model.discover(city: city)
        isLoading = false
    }
}

#Preview {
    DiscoverView()
        .environment(AppModel())
}
