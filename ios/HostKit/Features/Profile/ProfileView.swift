import SwiftUI

/// Who you are: photo, name, school, bio. Reached from the account menu.
struct ProfileView: View {
    @Environment(AppModel.self) private var model
    @State private var isEditing = false

    var body: some View {
        Form {
            if let user = model.user, model.isSignedIn {
                Section {
                    HStack(spacing: 14) {
                        HostAvatar(name: user.name, imageURL: user.imageURL, size: 64)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(user.name).font(.inter(.title3, .semibold))
                            Text(user.email).font(.inter(.subheadline)).foregroundStyle(.secondary)
                            if user.school != nil || user.company != nil {
                                HStack(spacing: 6) {
                                    if let school = user.school {
                                        StatusPill(text: school.name, tint: .accentColor)
                                        if let year = user.classYear {
                                            StatusPill(text: "Class of \(year)")
                                        }
                                    }
                                    if let company = user.company, !company.isEmpty {
                                        StatusPill(text: company)
                                    }
                                }
                            }
                        }
                    }
                    .padding(.vertical, 4)
                    if let bio = user.bio, !bio.isEmpty {
                        Text(bio).font(.inter(.subheadline)).foregroundStyle(.secondary)
                    }
                    if let socials = user.socials, !socials.isEmpty {
                        ScrollView(.horizontal) {
                            HStack(spacing: 8) {
                                ForEach(socials.links, id: \.url) { link in
                                    Link(destination: link.url) {
                                        Label(link.display, systemImage: link.symbol)
                                            .font(.inter(.caption, .medium))
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 6)
                                            .background(.quaternary.opacity(0.5), in: .capsule)
                                    }
                                    .accessibilityLabel("\(link.label): \(link.display)")
                                }
                            }
                        }
                        .scrollIndicators(.hidden)
                    }
                    Button("Edit profile") { isEditing = true }
                } footer: {
                    Text(user.school != nil
                        ? "Your events are tagged \(user.school!.short), and Discover leads with what’s on there."
                        : "Add your school to see your campus first — official events included — or your company.")
                }
            }
        }
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: model.user?.id) { await model.refreshProfile() }
        .sheet(isPresented: $isEditing) {
            if let user = model.user { EditProfileSheet(user: user) }
        }
    }
}
