import SwiftUI

/// Who you are, your profile, past events, settings, sign out. Presented as
/// a sheet from the logo, and as the Profile tab (`inTab`).
struct AccountMenu: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router
    @Environment(\.dismiss) private var dismiss
    @State private var isSigningIn = false

    var inTab = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if let user = model.user, model.isSignedIn {
                        HStack(spacing: 14) {
                            HostAvatar(name: user.name, imageURL: user.imageURL, size: 56)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(user.name).font(.inter(.title3, .semibold))
                                Text(user.email).font(.inter(.subheadline)).foregroundStyle(.secondary)
                                if let school = user.school {
                                    HStack(spacing: 6) {
                                        StatusPill(text: school.short, tint: .accentColor)
                                        if let year = user.classYear {
                                            StatusPill(text: "Class of \(year)")
                                        }
                                    }
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Host your own events").font(.inter(.headline, .semibold))
                            Text("Sign in to publish events, see your guest list and register in a tap. Students: use your school .edu email.")
                                .font(.inter(.footnote))
                                .foregroundStyle(.secondary)
                            Button("Sign in or create an account") { isSigningIn = true }
                                .buttonStyle(.glassProminent)
                                .padding(.top, 4)
                        }
                        .padding(.vertical, 4)
                    }
                }

                if model.isSignedIn {
                    Section {
                        NavigationLink {
                            ProfileView()
                        } label: {
                            Label("Profile", systemImage: "person")
                        }
                        NavigationLink {
                            PastEventsView()
                        } label: {
                            Label("Past events", systemImage: "clock.arrow.circlepath")
                        }
                    }
                }

                Section {
                    NavigationLink {
                        ClubsListView()
                    } label: {
                        Label("Clubs", systemImage: "person.3")
                    }
                    NavigationLink {
                        SettingsView()
                    } label: {
                        Label("Settings", systemImage: "gearshape")
                    }
                }

                if model.isSignedIn {
                    Section {
                        Button("Sign out", role: .destructive) {
                            model.signOut()
                            if !inTab { dismiss() }
                        }
                    }
                } else if !model.drafts.isEmpty {
                    Section {
                        Label("Drafts live on this iPhone until you sign in to publish them.", systemImage: "iphone")
                            .font(.inter(.footnote))
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .background { if inTab { BrandWash() } }
            .scrollContentBackground(inTab ? .hidden : .automatic)
            .navigationTitle(inTab ? "Profile" : "HostKit")
            .navigationBarTitleDisplayMode(inTab ? .large : .inline)
            .toolbar {
                if inTab {
                    ToolbarItem(placement: .topBarLeading) { LogoMark() }
                } else {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                }
            }
            .navigationDestination(for: HostEvent.self) { event in
                ManageEventView(event: event) { _ in }
            }
            .sheet(isPresented: $isSigningIn) { SignInView() }
        }
    }
}
