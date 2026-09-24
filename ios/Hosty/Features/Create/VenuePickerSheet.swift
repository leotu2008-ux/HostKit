import SwiftUI

/// Search MapKit for a place to hold the night and hand it back to Create.
struct VenuePickerSheet: View {
    @Environment(\.dismiss) private var dismiss

    let city: String
    let onPick: (VenuePick) -> Void

    @State private var query = ""
    @State private var results: [VenuePick] = []
    @State private var isSearching = false
    @State private var errorMessage: String?
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            List {
                if results.isEmpty && !isSearching {
                    ContentUnavailableView(
                        query.count < 2 ? "Find a venue" : "No places found",
                        systemImage: "mappin.and.ellipse",
                        description: Text(query.count < 2
                            ? "Bars, lofts, rooftops, studios — anything near \(Cities.short(city))."
                            : "Try a different word, or a specific name."))
                        .listRowBackground(Color.clear)
                }
                ForEach(results) { venue in
                    Button {
                        onPick(venue)
                        dismiss()
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(venue.name).font(.inter(.body, .medium)).foregroundStyle(.primary)
                            if let address = venue.address {
                                Text(address).font(.inter(.footnote)).foregroundStyle(.secondary)
                            }
                            if venue.phone != nil || venue.website != nil {
                                Text([venue.phone, venue.website].compactMap { $0 }.joined(separator: " · "))
                                    .font(.inter(.caption)).foregroundStyle(.tertiary).lineLimit(1)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.red)
                }
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always),
                        prompt: "Search venues near \(Cities.short(city))")
            .overlay { if isSearching { ProgressView() } }
            .navigationTitle("Venue")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", role: .cancel) { dismiss() }
                }
            }
            .onChange(of: query) { _, text in
                searchTask?.cancel()
                let trimmed = text.trimmingCharacters(in: .whitespaces)
                guard trimmed.count >= 2 else {
                    results = []
                    return
                }
                searchTask = Task {
                    try? await Task.sleep(for: .milliseconds(350))
                    guard !Task.isCancelled else { return }
                    await run(trimmed)
                }
            }
        }
        .presentationDetents([.large])
    }

    private func run(_ text: String) async {
        isSearching = true
        errorMessage = nil
        defer { isSearching = false }
        do {
            results = try await VenueSearch.search(text, city: city)
        } catch {
            results = []
            errorMessage = "Couldn't search right now."
        }
    }
}
