import PhotosUI
import SwiftUI

/// A club's page: who they are, what's coming up, follow.
struct ClubView: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router

    let handle: String

    @State private var page: ClubPage?
    @State private var errorMessage: String?
    @State private var isBusy = false
    @State private var isSigningIn = false
    @State private var isPickingPhoto = false
    @State private var photoItem: PhotosPickerItem?
    @State private var draft = ""
    @State private var isPosting = false

    var body: some View {
        ScrollView {
            if let page {
                VStack(alignment: .leading, spacing: 20) {
                    header(page.club)

                    if let blurb = page.club.blurb, !blurb.isEmpty {
                        Text(blurb).font(.inter(.body)).lineSpacing(3)
                    }

                    if page.club.canManage || !page.updates.isEmpty {
                        updatesSection(page)
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Coming up").font(.inter(.title3, .semibold))
                        if page.events.isEmpty {
                            Text(page.club.canManage
                                ? "Post an event as the club and it lands here for followers."
                                : "Follow to hear the moment they post one.")
                                .font(.inter(.subheadline))
                                .foregroundStyle(.secondary)
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(.quaternary.opacity(0.4), in: .rect(cornerRadius: 14))
                        } else {
                            ForEach(page.events) { event in
                                NavigationLink(value: event) { EventRow(event: event) }
                                    .buttonStyle(.plain)
                            }
                        }
                    }

                    if !page.past.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Past events").font(.inter(.title3, .semibold))
                            ForEach(page.past) { event in
                                NavigationLink(value: event) { EventRow(event: event) }
                                    .buttonStyle(.plain)
                                    .opacity(0.8)
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Run by").font(.inter(.title3, .semibold))
                        ForEach(page.members) { member in
                            HStack(spacing: 12) {
                                HostAvatar(name: member.name, imageURL: member.imageURL, size: 34)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(member.name).font(.inter(.body, .medium))
                                    Text(member.role == "OWNER" ? "Owner" : "Admin")
                                        .font(.inter(.caption)).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }

                    if let errorMessage {
                        NoticeBanner(text: errorMessage)
                    }
                }
                .padding()
                .padding(.bottom, 24)
            } else if let errorMessage {
                NoticeBanner(text: errorMessage).padding()
            } else {
                ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
            }
        }
        .background { BrandWash() }
        .navigationTitle(page?.club.name ?? "Club")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: HostEvent.self) { event in
            EventDetailView(event: event)
        }
        .toolbar {
            if let club = page?.club {
                ToolbarItem(placement: .topBarTrailing) {
                    ShareLink(item: model.serverURL.appending(path: club.webPath)) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                }
            }
        }
        .sheet(isPresented: $isSigningIn) { SignInView() }
        .photosPicker(isPresented: $isPickingPhoto, selection: $photoItem, matching: .images)
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task { await setPhoto(item) }
        }
        .task(id: handle) { await load() }
        .refreshable { await load() }
    }

    private func header(_ club: Club) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if let cover = club.coverURL {
                AsyncImage(url: cover) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.secondary.opacity(0.15)
                }
                .frame(height: 140)
                .clipShape(.rect(cornerRadius: 18))
            }
            HStack(alignment: .top, spacing: 14) {
                Group {
                    if club.canManage {
                        Menu {
                            Button("Choose photo", systemImage: "photo") { isPickingPhoto = true }
                        } label: {
                            HostAvatar(name: club.name, imageURL: club.imageURL, size: 64)
                        }
                        .buttonStyle(.plain)
                    } else {
                        HostAvatar(name: club.name, imageURL: club.imageURL, size: 64)
                    }
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(club.name).font(.event(24))
                    Text("/c/\(club.handle)").font(.inter(.caption)).foregroundStyle(.secondary)
                    HStack(spacing: 6) {
                        if let school = club.school {
                            StatusPill(text: school.short, tint: .accentColor)
                        }
                        if let label = club.categoryLabel {
                            StatusPill(text: label)
                        }
                        StatusPill(text: "\(club.followers) \(club.followers == 1 ? "follower" : "followers")")
                        if let hosted = page?.stats?.eventsHosted, hosted > 0 {
                            StatusPill(text: "\(hosted) \(hosted == 1 ? "event" : "events")")
                        }
                    }
                }
                Spacer(minLength: 0)
            }
            HStack(spacing: 10) {
                if club.isFollowing {
                    Button {
                        Task { await toggleFollow(club) }
                    } label: {
                        Label("Following", systemImage: "checkmark").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glass)
                    .controlSize(.large)
                    .disabled(isBusy)
                } else {
                    Button {
                        Task { await toggleFollow(club) }
                    } label: {
                        Label("Follow", systemImage: "plus").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glassProminent)
                    .controlSize(.large)
                    .disabled(isBusy)
                }
                if club.canManage {
                    Button("Post an event", systemImage: "plus.circle") { router.startCreate() }
                        .buttonStyle(.glass)
                        .controlSize(.large)
                }
            }
        }
    }

    /// Admins' notes to followers; admins get a composer and can take one down.
    @ViewBuilder
    private func updatesSection(_ page: ClubPage) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Updates").font(.inter(.title3, .semibold))
            if page.club.canManage {
                VStack(alignment: .leading, spacing: 8) {
                    TextField("Doors at 7, bring a friend. Anything followers should know.", text: $draft, axis: .vertical)
                        .lineLimit(2...5)
                        .font(.inter(.body))
                    HStack {
                        Text("Lands in \(page.club.followers) \(page.club.followers == 1 ? "follower’s" : "followers’") Inbox.")
                            .font(.inter(.caption)).foregroundStyle(.secondary)
                        Spacer()
                        Button("Post") { Task { await postUpdate() } }
                            .buttonStyle(.glassProminent)
                            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isPosting)
                    }
                }
                .padding(12)
                .background(.background, in: .rect(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(.quaternary))
            }
            if page.updates.isEmpty {
                Text("Nothing posted yet. A short note here goes straight to every follower.")
                    .font(.inter(.subheadline)).foregroundStyle(.secondary)
            }
            ForEach(page.updates) { update in
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        if let author = update.author {
                            HostAvatar(name: author.name, imageURL: author.imageURL, size: 20)
                            Text(author.name).font(.inter(.caption, .medium))
                        }
                        Text(update.createdAt.formatted(.relative(presentation: .named)))
                            .font(.inter(.caption)).foregroundStyle(.secondary)
                        Spacer()
                        if page.club.canManage {
                            Button("Remove", role: .destructive) { Task { await deleteUpdate(update) } }
                                .font(.inter(.caption))
                        }
                    }
                    Text(update.body).font(.inter(.body)).lineSpacing(2)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.background, in: .rect(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(.quaternary))
            }
        }
    }

    private func postUpdate() async {
        guard let handle = page?.club.handle else { return }
        isPosting = true
        defer { isPosting = false }
        do {
            let update = try await model.api.postClubUpdate(handle: handle, body: draft.trimmingCharacters(in: .whitespacesAndNewlines))
            page?.updates.insert(update, at: 0)
            draft = ""
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteUpdate(_ update: ClubUpdate) async {
        guard let handle = page?.club.handle else { return }
        do {
            try await model.api.deleteClubUpdate(handle: handle, id: update.id)
            page?.updates.removeAll { $0.id == update.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func load() async {
        do {
            page = try await model.api.club(handle: handle)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func toggleFollow(_ club: Club) async {
        guard model.isSignedIn else {
            isSigningIn = true
            return
        }
        isBusy = true
        defer { isBusy = false }
        do {
            let updated = try await model.api.setFollowing(handle: club.handle, !club.isFollowing)
            page?.club = updated
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func setPhoto(_ item: PhotosPickerItem) async {
        defer { photoItem = nil }
        guard let handle = page?.club.handle else { return }
        do {
            guard let jpeg = try await PhotoJPEG.data(from: item) else { return }
            page?.club = try await model.api.setClubPhoto(handle: handle, jpeg, contentType: PhotoJPEG.contentType)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
