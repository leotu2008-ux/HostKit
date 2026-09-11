import SwiftUI

/// Registers the signed-in account for a night. Signed out, it shows the
/// sign-in / create-account sheet first and continues once that's done — the
/// host's updates go to the account's email, so there's no free-text form.
/// Where you land depends on the event: in, waiting for the host, or on the
/// waitlist.
struct RegisterSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    let event: HostEvent
    let onRegistered: (RegistrationState) -> Void

    @State private var isSigningIn = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var done = false
    @State private var extras = AppModel.RegistrationExtras()

    /// Straight in, ask the host, or join the line.
    private var mode: String {
        if event.requiresApproval ?? false { return "request" }
        if event.isFull { return "waitlist" }
        return "register"
    }

    private var actionTitle: String {
        switch mode {
        case "request": "Request to join"
        case "waitlist": "Join waitlist"
        default: "Register"
        }
    }

    private var doneTitle: String {
        switch extras.state {
        case .pending: "Request sent"
        case .waitlisted: "You’re on the waitlist"
        default: "You’re in"
        }
    }

    private var doneDescription: String {
        let email = model.user?.email ?? "your email"
        switch extras.state {
        case .pending:
            return "The host confirms each guest for \(event.title). You’ll hear at \(email) once they do."
        case .waitlisted:
            return "\(event.title) is full right now. If a spot opens you’re in automatically — we’ll tell you at \(email)."
        default:
            var lines = ["See you at \(event.title). Updates from the host go to \(email)."]
            switch (extras.reminderSet, extras.calendarAdded) {
            case (true, true): lines.append("Added to your calendar, with reminders the evening before and an hour out.")
            case (true, false): lines.append("We’ll remind you the evening before and an hour out.")
            case (false, true): lines.append("Added to your calendar.")
            default: break
            }
            return lines.joined(separator: " ")
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if done {
                    ContentUnavailableView {
                        Label(doneTitle, systemImage: extras.state == .going ? "checkmark.seal.fill" : "clock.badge.checkmark")
                            .foregroundStyle(extras.state == .going ? .green : .orange)
                    } description: {
                        Text(doneDescription)
                    } actions: {
                        Button("Done") { dismiss() }
                            .buttonStyle(.glassProminent)
                    }
                } else {
                    Form {
                        Section {
                            HStack(spacing: 12) {
                                EventCover(event: event)
                                    .frame(width: 48, height: 48)
                                    .clipShape(.rect(cornerRadius: 10))
                                VStack(alignment: .leading) {
                                    Text(event.title).font(.event(17))
                                    Text(EventDates.summary(for: event))
                                        .font(.inter(.caption)).foregroundStyle(.secondary)
                                }
                            }
                        }
                        if let user = model.user, model.isSignedIn {
                            Section {
                                LabeledContent("Registering as", value: user.name)
                                LabeledContent("Email", value: user.email)
                            } footer: {
                                Text(mode == "request"
                                    ? "The host approves each guest. They’ll see your name and email."
                                    : mode == "waitlist"
                                        ? "This night is full. You’ll be let in automatically when a spot opens."
                                        : "The host sees your name and email, and sends updates there.")
                            }
                        } else {
                            Section {
                                Button("Sign in or create an account") { isSigningIn = true }
                            } footer: {
                                Text("Registering needs an account so the host can reach you about the night.")
                            }
                        }
                        if let errorMessage {
                            Section { Text(errorMessage).foregroundStyle(.red) }
                        }
                    }
                }
            }
            .navigationTitle(done ? "" : actionTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if !done {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel", role: .cancel) { dismiss() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button(actionTitle) { Task { await submit() } }
                            .disabled(!model.isSignedIn || isSubmitting)
                    }
                }
            }
            .sheet(isPresented: $isSigningIn) { SignInView() }
            .onAppear { if !model.isSignedIn { isSigningIn = true } }
        }
        .presentationDetents([.medium, .large])
    }

    private func submit() async {
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        do {
            extras = try await model.register(for: event)
            done = true
            onRegistered(extras.state)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
