import SwiftUI

/// Asks for a password-reset link. Always says "sent", on purpose — the
/// form can't be used to check who has an account. The link opens on any
/// device; the new password then works here and on the website.
struct ForgotPasswordView: View {
    @Environment(AppModel.self) private var model
    @State private var email: String
    @State private var isSending = false
    @State private var sent = false
    @State private var errorMessage: String?

    init(email: String = "") {
        _email = State(initialValue: email)
    }

    private var canSend: Bool { email.contains("@") && !isSending }

    var body: some View {
        Form {
            if sent {
                Section {
                    Label("If that address has an account, a reset link is on its way.", systemImage: "envelope.badge")
                        .font(.inter(.body))
                    Text("It works for an hour. Open it on any device, set a new password, then come back and sign in.")
                        .font(.inter(.footnote))
                        .foregroundStyle(.secondary)
                }
            } else {
                Section {
                    TextField("Email", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onSubmit { if canSend { Task { await send() } } }
                } footer: {
                    Text("We’ll email a link to set a new password.")
                }
                Section {
                    Button {
                        Task { await send() }
                    } label: {
                        Text(isSending ? "Sending…" : "Send reset link")
                            .font(.inter(.body, .semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glassProminent)
                    .controlSize(.large)
                    .disabled(!canSend)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red) }
                }
            }
        }
        .navigationTitle("Forgot password")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func send() async {
        isSending = true
        errorMessage = nil
        defer { isSending = false }
        do {
            try await model.api.forgotPassword(email: email.trimmingCharacters(in: .whitespaces))
            sent = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack { ForgotPasswordView(email: "you@babson.edu") }
        .environment(AppModel())
}
