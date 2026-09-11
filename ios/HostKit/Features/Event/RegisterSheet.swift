import SwiftUI

struct RegisterSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    let event: HostEvent
    let onRegistered: () -> Void

    @State private var name = ""
    @State private var email = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var done = false

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && email.contains("@") && !isSubmitting
    }

    var body: some View {
        NavigationStack {
            Group {
                if done {
                    ContentUnavailableView {
                        Label("You’re in", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(.green)
                    } description: {
                        Text("See you at \(event.title).")
                    } actions: {
                        Button("Done") { dismiss() }
                            .buttonStyle(.glassProminent)
                    }
                } else {
                    Form {
                        Section {
                            HStack(spacing: 12) {
                                CoverArt(seed: event.id)
                                    .frame(width: 48, height: 48)
                                    .clipShape(.rect(cornerRadius: 10))
                                VStack(alignment: .leading) {
                                    Text(event.title).font(.event(17))
                                    Text(EventDates.summary(for: event))
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                        Section {
                            TextField("Name", text: $name)
                                .textContentType(.name)
                            TextField("Email", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        } footer: {
                            Text("No account needed. The host sees your name and email.")
                        }
                        if let errorMessage {
                            Section {
                                Text(errorMessage).foregroundStyle(.red)
                            }
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
                            .disabled(!canSubmit)
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func submit() async {
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        do {
            try await model.register(for: event, name: name, email: email)
            done = true
            onRegistered()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
