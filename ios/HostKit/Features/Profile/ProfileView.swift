import AppIntents
import SwiftUI

struct ProfileView: View {
    @Environment(AppModel.self) private var model
    @State private var server = ""
    @State private var serverError: String?
    @State private var isSigningIn = false
    @State private var showSiriTip = true

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if let user = model.user, model.isSignedIn {
                        HStack(spacing: 14) {
                            HostAvatar(name: user.name, size: 52)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(user.name).font(.title3.weight(.semibold))
                                Text(user.email).font(.subheadline).foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                        Button("Sign out", role: .destructive) { model.signOut() }
                    } else {
                        Button("Sign in") { isSigningIn = true }
                    }
                }

                if model.isSignedIn {
                    Section("Siri & Shortcuts") {
                        SiriTipView(intent: NextEventIntent(), isVisible: $showSiriTip)
                        Text("Try “Check in a guest with HostKit” at the door.")
                            .font(.footnote)
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
            .onAppear { server = model.serverURL.absoluteString }
            .sheet(isPresented: $isSigningIn) { SignInView() }
        }
    }

    private func saveServer() {
        serverError = model.setServer(server) ? nil : "Enter a full http(s) address."
        if serverError == nil { server = model.serverURL.absoluteString }
    }
}
