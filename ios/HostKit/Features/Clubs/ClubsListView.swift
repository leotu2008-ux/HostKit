import SwiftUI

/// A club in a list or strip: picture, name, school, followers.
struct ClubCard: View {
    let club: Club
    var compact = false

    var body: some View {
        HStack(spacing: 12) {
            HostAvatar(name: club.name, imageURL: club.imageURL, size: compact ? 40 : 48)
            VStack(alignment: .leading, spacing: 2) {
                Text(club.name).font(.inter(.body, .medium)).lineLimit(1)
                Text([club.school?.short, "\(club.followers) \(club.followers == 1 ? "follower" : "followers")"]
                    .compactMap { $0 }.joined(separator: " · "))
                    .font(.inter(.caption)).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(compact ? 10 : 12)
        .frame(width: compact ? 220 : nil, alignment: .leading)
        .background(.background, in: .rect(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(.quaternary))
        .contentShape(.rect(cornerRadius: 16))
    }
}

/// Yours, the ones you follow, and the ones around you.
struct ClubsListView: View {
    @Environment(AppModel.self) private var model
    @State private var feed = ClubsFeed(mine: [], suggested: [])
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var isCreating = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                if let errorMessage { NoticeBanner(text: errorMessage) }
                if model.isSignedIn {
                    section("Your clubs", feed.mine,
                            empty: "You don’t run a club yet. Start a page and post events as the club.")
                }
                section(model.user?.school.map { "At \($0.short)" } ?? "Around", feed.suggested,
                        empty: isLoading ? "Loading…" : "No clubs here yet — be the first to start one.")
            }
            .padding(.horizontal)
            .padding(.bottom, 24)
        }
        .background { BrandWash() }
        .navigationTitle("Clubs")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: Club.self) { club in ClubView(handle: club.handle) }
        .toolbar {
            if model.isSignedIn {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Start a club", systemImage: "plus") { isCreating = true }
                }
            }
        }
        .sheet(isPresented: $isCreating) {
            NewClubView { created in
                feed.mine.insert(created, at: 0)
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func section(_ title: String, _ clubs: [Club], empty: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.inter(.title3, .semibold))
            if clubs.isEmpty {
                Text(empty)
                    .font(.inter(.subheadline)).foregroundStyle(.secondary)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.quaternary.opacity(0.4), in: .rect(cornerRadius: 14))
            } else {
                ForEach(clubs) { club in
                    NavigationLink(value: club) { ClubCard(club: club) }
                        .buttonStyle(.plain)
                }
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            feed = try await model.api.clubs(city: Session.city.flatMap { $0.isEmpty ? nil : $0 })
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// Start a club page.
struct NewClubView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let onCreated: (Club) -> Void

    @State private var name = ""
    @State private var handle = ""
    @State private var handleEdited = false
    @State private var blurb = ""
    @State private var city: String = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    private var suggested: String {
        let slug = name.lowercased().replacing(/[^a-z0-9]+/, with: "-")
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return String(slug.prefix(30))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Club name", text: $name)
                        .onChange(of: name) { _, _ in if !handleEdited { handle = suggested } }
                    HStack(spacing: 2) {
                        Text("/c/").foregroundStyle(.secondary)
                        TextField("handle", text: $handle)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .onChange(of: handle) { _, value in
                                handleEdited = true
                                handle = value.lowercased()
                            }
                    }
                } footer: {
                    Text("Your page lives at /c/handle — letters, numbers and dashes, 3–30. It can't change later.")
                }
                Section {
                    TextField("What it's about", text: $blurb, axis: .vertical).lineLimit(2...4)
                    Picker("City", selection: $city) {
                        Text("Not set").tag("")
                        ForEach(Cities.all, id: \.self) { Text($0).tag($0) }
                    }
                } footer: {
                    Text(model.user?.school.map { "As a \($0.short) student, your club shows up at \($0.short) first." }
                        ?? "Followers hear about every event you post as the club.")
                }
                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Start a club")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", role: .cancel) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await save() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).count < 2 || handle.count < 3 || isSaving)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            let club = try await model.api.createClub(NewClubRequest(
                name: name.trimmingCharacters(in: .whitespaces),
                handle: handle,
                blurb: blurb.isEmpty ? nil : blurb,
                city: city.isEmpty ? nil : city))
            onCreated(club)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// A horizontal strip of clubs for Discover.
struct ClubsStrip: View {
    let title: String
    let clubs: [Club]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(title).font(.inter(.title3, .semibold))
                Spacer()
                NavigationLink("See all") { ClubsListView() }
                    .font(.inter(.subheadline, .medium))
            }
            ScrollView(.horizontal) {
                HStack(spacing: 12) {
                    ForEach(clubs) { club in
                        NavigationLink(value: club) { ClubCard(club: club, compact: true) }
                            .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal)
            }
            .scrollIndicators(.hidden)
            .padding(.horizontal, -16)
        }
    }
}
