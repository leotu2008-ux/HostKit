import SwiftUI

/// Sign in or create an account, on one sheet. A new account waits for the
/// link in its confirmation email before it can sign in; a .edu email makes
/// it a student account.
struct SignInView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    enum Mode: String, CaseIterable {
        case signIn = "Sign in"
        case create = "Create account"
    }

    @State private var mode: Mode = .signIn
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var showsPassword = false
    /// An address that has an account but hasn’t opened its link yet.
    @State private var pendingEmail: String?
    /// The link itself, only from a development server with no email service.
    @State private var devLink: URL?
    @State private var resent = false

    private func resend() async {
        guard let pendingEmail else { return }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        do {
            devLink = try await model.api.resendVerification(to: pendingEmail)
            resent = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private var isStudentEmail: Bool {
        email.lowercased().trimmingCharacters(in: .whitespaces).hasSuffix(".edu")
    }

    private var canSubmit: Bool {
        let hasName = mode == .signIn || !name.trimmingCharacters(in: .whitespaces).isEmpty
        let hasPassword = mode == .signIn ? !password.isEmpty : password.count >= 8
        return hasName && email.contains("@") && hasPassword && !isSubmitting
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Mode", selection: $mode) {
                        ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }

                Section {
                    if mode == .create {
                        TextField("Your name", text: $name)
                            .textContentType(.name)
                    }
                    TextField(mode == .create ? "Email (use your school .edu)" : "Email", text: $email)
                        .textContentType(mode == .create ? .emailAddress : .username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    HStack {
                        Group {
                            if showsPassword {
                                TextField("Password", text: $password)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                            } else {
                                SecureField("Password", text: $password)
                            }
                        }
                        .textContentType(mode == .create ? .newPassword : .password)
                        .onSubmit { if canSubmit { Task { await submit() } } }
                        Button {
                            showsPassword.toggle()
                        } label: {
                            Image(systemName: showsPassword ? "eye.slash" : "eye")
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(showsPassword ? "Hide password" : "Show password")
                    }
                } footer: {
                    switch mode {
                    case .signIn:
                        Text("Same account as the website.")
                    case .create:
                        Text(isStudentEmail
                            ? "A school email — you’ll see what’s on at your campus first."
                            : "At least 8 characters for the password. Students: sign up with your school .edu email to see campus events first.")
                    }
                }

                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        Text(isSubmitting ? "One moment…" : mode == .signIn ? "Sign in" : "Create account")
                            .font(.inter(.body, .semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glassProminent)
                    .controlSize(.large)
                    .disabled(!canSubmit)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    if mode == .signIn {
                        NavigationLink("Forgot your password?") {
                            ForgotPasswordView(email: email.trimmingCharacters(in: .whitespaces))
                        }
                        .font(.inter(.subheadline))
                    }
                }

                if let pendingEmail {
                    Section {
                        Text("We sent a confirmation link to \(pendingEmail). Open it, then sign in here.")
                            .font(.inter(.footnote))
                        if let devLink {
                            Link("Open the confirmation link (development)", destination: devLink)
                        }
                        if resent {
                            Text("Sent again — check your inbox.")
                                .font(.inter(.footnote)).foregroundStyle(.secondary)
                        } else {
                            Button("Resend the link") { Task { await resend() } }
                                .disabled(isSubmitting)
                        }
                    } header: {
                        Text("Check your inbox")
                    }
                }

                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red) }
                }
            }
            .navigationTitle(mode.rawValue)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", role: .cancel) { dismiss() }
                }
            }
            .onChange(of: mode) { errorMessage = nil }
            .onChange(of: email) { pendingEmail = nil }
        }
        .presentationDetents([.large])
    }

    private func submit() async {
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        do {
            switch mode {
            case .signIn:
                try await model.signIn(email: email, password: password)
            case .create:
                let outcome = try await model.signUp(
                    name: name.trimmingCharacters(in: .whitespaces),
                    email: email.trimmingCharacters(in: .whitespaces),
                    password: password)
                if case .pending(let address, let link) = outcome {
                    // The account exists; it signs in once the link is opened.
                    pendingEmail = address
                    devLink = link
                    resent = false
                    mode = .signIn
                    return
                }
            }
            dismiss()
        } catch let error as APIError where error.code == "email_unverified" {
            // Right password, unconfirmed address: show the resend, not a failure.
            pendingEmail = email.trimmingCharacters(in: .whitespaces).lowercased()
            devLink = nil
            resent = false
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
