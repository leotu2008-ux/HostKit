import SwiftUI

/// Registers the signed-in account for a night. Signed out, it shows the
/// sign-in / create-account sheet first and continues once that's done — the
/// host's updates go to the account's email, so there's no free-text form.
struct RegisterSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    let event: HostEvent
    let onRegistered: () -> Void

    @State private var isSigningIn = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var done = false

    var body: some View {
        NavigationStack {
            Group {
                if done {
                    ContentUnavailableView {
                        Label("You’re in", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(.green)
                    } description: {
                        Text("See you at \(event.title). Updates from the host go to \(model.user?.email ?? "your email").")
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
                                Text("The host sees your name and email, and sends updates there.")
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
            .navigationTitle(done ? "" : "Register")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if !done {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel", role: .cancel) { dismiss() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Register") { Task { await submit() } }
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
            try await model.register(for: event)
            done = true
            onRegistered()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
