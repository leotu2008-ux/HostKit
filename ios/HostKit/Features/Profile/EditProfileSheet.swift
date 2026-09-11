import PhotosUI
import SwiftUI

struct EditProfileSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var classYear: String
    @State private var bio: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    @State private var photoItem: PhotosPickerItem?
    @State private var isUploadingPhoto = false

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
                // The photo saves on its own as soon as it's picked.
                Section {
                    HStack(spacing: 16) {
                        HostAvatar(name: name, imageURL: model.user?.imageURL, size: 64)
                            .overlay(alignment: .bottomTrailing) {
                                if isUploadingPhoto { ProgressView().controlSize(.small) }
                            }
                        VStack(alignment: .leading, spacing: 6) {
                            PhotosPicker(
                                model.user?.imageURL == nil ? "Add photo" : "Change photo",
                                selection: $photoItem, matching: .images)
                                .font(.inter(.subheadline, .semibold))
                            if model.user?.imageURL != nil {
                                Button("Remove photo", role: .destructive) {
                                    Task { await removePhoto() }
                                }
                                .font(.inter(.subheadline))
                            }
                        }
                        .disabled(isUploadingPhoto)
                    }
                    .padding(.vertical, 4)
                }

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
            .onChange(of: photoItem) { _, item in
                guard let item else { return }
                Task { await uploadPhoto(item) }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func uploadPhoto(_ item: PhotosPickerItem) async {
        isUploadingPhoto = true
        errorMessage = nil
        defer {
            isUploadingPhoto = false
            photoItem = nil
        }
        do {
            guard let jpeg = try await PhotoJPEG.data(from: item) else {
                errorMessage = "Couldn't read that photo."
                return
            }
            try await model.setAvatar(jpeg)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func removePhoto() async {
        isUploadingPhoto = true
        defer { isUploadingPhoto = false }
        do {
            try await model.removeAvatar()
        } catch {
            errorMessage = error.localizedDescription
        }
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
