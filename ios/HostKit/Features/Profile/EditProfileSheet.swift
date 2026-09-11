import SwiftUI

struct EditProfileSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var classYear: String
    @State private var bio: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let isStudent: Bool

    init(user: HostUser) {
        _name = State(initialValue: user.name)
        _classYear = State(initialValue: user.classYear.map(String.init) ?? "")
        _bio = State(initialValue: user.bio ?? "")
        isStudent = user.isStudent
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $name)
                        .textContentType(.name)
                    if isStudent {
                        TextField("Class year", text: $classYear)
                            .keyboardType(.numberPad)
                    }
                    TextField("About you", text: $bio, axis: .vertical)
                        .lineLimit(2...4)
                } footer: {
                    Text(isStudent
                        ? "Your school comes from your email and can't be changed here."
                        : "One line is plenty.")
                }
                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Edit profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", role: .cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func save() async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            try await model.updateProfile(
                name: name.trimmingCharacters(in: .whitespaces),
                classYear: Int(classYear.trimmingCharacters(in: .whitespaces)),
                bio: bio.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : bio)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
