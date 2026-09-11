import AppIntents
import SwiftUI

/// Account and app settings: Siri, Apple Intelligence, which server to talk to.
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var server = ""
    @State private var serverError: String?
    @State private var showSiriTip = true
    @State private var remindersOn = Session.remindersEnabled
    @State private var calendarOn = Session.calendarEnabled
    @State private var remindersDenied = false
    @State private var showOnGuestLists = Session.user?.showOnGuestLists ?? true

    var body: some View {
        Form {
            if model.isSignedIn {
                Section {
                    Toggle("Show me on guest lists", isOn: $showOnGuestLists)
                        .onChange(of: showOnGuestLists) { _, on in
                            Task { try? await model.setShowOnGuestLists(on) }
                        }
                } header: {
                    Text("Who’s going")
                } footer: {
                    Text("Event pages show the first few people going — first name and photo. Turn this off to sit that out.")
                }
            }

            Section {
                Toggle("Remind me before events", isOn: $remindersOn)
                    .onChange(of: remindersOn) { _, on in
                        Session.remindersEnabled = on
                        Task {
                            if on {
                                remindersDenied = !(await Reminders.requestPermission())
                            } else {
                                await Reminders.cancelAll()
                            }
                        }
                    }
                if remindersDenied && remindersOn {
                    Text("Notifications are off for HostKit in Settings.")
                        .font(.inter(.footnote))
                        .foregroundStyle(.red)
                }
                Toggle("Add to my calendar when I register", isOn: $calendarOn)
                    .onChange(of: calendarOn) { _, on in Session.calendarEnabled = on }
            } header: {
                Text("Going to events")
            } footer: {
                Text("The evening before and an hour before each event you register for. Calendar access is write-only — HostKit never reads your calendar.")
            }

            if model.isSignedIn {
                Section {
                    if let user = model.user, user.hasVerifiedPhone, let phone = user.phone {
                        HStack {
                            Text(PhoneFormat.pretty(phone))
                            Spacer()
                            StatusPill(text: "Verified", tint: .green)
                        }
                        Button("Remove number", role: .destructive) {
                            Task { try? await model.removePhone() }
                        }
                    } else {
                        NavigationLink {
                            PhoneView()
                        } label: {
                            Label("Add phone number", systemImage: "phone")
                        }
                    }
                } header: {
                    Text("Phone")
                } footer: {
                    Text("Hosts of events you register for can see this number. Confirmed with a text.")
                }

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
                Text("Light and dark follow your device’s appearance setting.")
                    .font(.inter(.footnote))
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { server = model.serverURL.absoluteString }
    }

    private func saveServer() {
        serverError = model.setServer(server) ? nil : "Enter a full http(s) address."
        if serverError == nil { server = model.serverURL.absoluteString }
    }
}
