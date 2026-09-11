import AppIntents
import SwiftUI

struct ProfileView: View {
    @Environment(AppModel.self) private var model
    @State private var server = ""
    @State private var serverError: String?
    @State private var isSigningIn = false
    @State private var isEditing = false
    @State private var showSiriTip = true

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if let user = model.user, model.isSignedIn {
                        HStack(spacing: 14) {
                            HostAvatar(name: user.name, size: 52)
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
                        Button("Sign out", role: .destructive) { model.signOut() }
                    } else {
                        Button("Sign in") { isSigningIn = true }
                        Text("Students: sign up with your school .edu email to see what’s on at your campus first.")
                            .font(.inter(.footnote))
                            .foregroundStyle(.secondary)
                    }
                }

                if model.isSignedIn {
                    Section("Siri & Shortcuts") {
                        SiriTipView(intent: NextEventIntent(), isVisible: $showSiriTip)
                        Text("Try “Check in a guest with HostKit” at the door.")
                            .font(.inter(.footnote))
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Apple Intelligence") {
                    Label(
                        DescriptionWriter.unavailableReason ?? "Ready to draft event descriptions on this device.",
                        systemImage: DescriptionWriter.unavailableReason == nil ? "checkmark.circle" : "info.circle")
                }

                Section {
                    TextField("https://…", text: $server)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onSubmit(saveServer)
                    Button("Save server", action: saveServer)
                        .disabled(server == model.serverURL.absoluteString)
                    if let serverError {
                        Text(serverError).foregroundStyle(.red)
                    }
                } header: {
                    Text("Server")
                } footer: {
                    Text("The HostKit website this app talks to. Use a Vercel preview URL, or http://localhost:3000 while running `npm run dev` and the Simulator. Changing it signs you out.")
                }

                Section {
                    Link("Open HostKit on the web", destination: model.serverURL)
                    LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "–")
                }
            }
            .navigationTitle("You")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { LogoMark() }
            }
            .onAppear { server = model.serverURL.absoluteString }
            .task(id: model.user?.id) { await model.refreshProfile() }
            .sheet(isPresented: $isSigningIn) { SignInView() }
            .sheet(isPresented: $isEditing) {
                if let user = model.user { EditProfileSheet(user: user) }
            }
        }
    }

    private func saveServer() {
        serverError = model.setServer(server) ? nil : "Enter a full http(s) address."
        if serverError == nil { server = model.serverURL.absoluteString }
    }
}
