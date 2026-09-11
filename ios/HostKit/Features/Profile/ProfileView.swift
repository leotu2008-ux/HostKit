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
                            if let school = user.school {
                                HStack(spacing: 6) {
                                    StatusPill(text: school.name, tint: .accentColor)
                                    if let year = user.classYear {
                                        StatusPill(text: "Class of \(year)")
                                    }
                                }
                            }
                        }
                    }
                    .padding(.vertical, 4)
                    if let bio = user.bio, !bio.isEmpty {
                        Text(bio).font(.inter(.subheadline)).foregroundStyle(.secondary)
                    }
                    Button("Edit profile") { isEditing = true }
                } footer: {
                    Text(user.school != nil
                        ? "Your school comes from your \(user.school!.domain) email."
                        : "Students: sign up with your school .edu email to see what’s on at your campus first.")
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
