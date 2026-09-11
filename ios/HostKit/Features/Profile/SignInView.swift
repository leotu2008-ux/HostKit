import SwiftUI

/// Sign in or create an account, on one sheet. Creating an account signs you
/// in straight away; a .edu email makes it a student account.
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
                    SecureField("Password", text: $password)
                        .textContentType(mode == .create ? .newPassword : .password)
                        .onSubmit { if canSubmit { Task { await submit() } } }
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
                ToolbarItem(placement: .confirmationAction) {
                    Button(mode == .signIn ? "Sign in" : "Create") { Task { await submit() } }
                        .disabled(!canSubmit)
                }
            }
            .onChange(of: mode) { errorMessage = nil }
        }
        .presentationDetents([.medium, .large])
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
                try await model.signUp(
                    name: name.trimmingCharacters(in: .whitespaces),
                    email: email.trimmingCharacters(in: .whitespaces),
                    password: password)
            }
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
