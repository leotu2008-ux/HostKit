import PhotosUI
import SwiftUI

struct EditProfileSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var schoolDomain: String
    @State private var classYear: String
    @State private var company: String
    @State private var bio: String
    @State private var schools: [SchoolOption] = []
    @State private var isSaving = false
    @State private var errorMessage: String?

    @State private var photoItem: PhotosPickerItem?
    @State private var isUploadingPhoto = false

    init(user: HostUser) {
        _name = State(initialValue: user.name)
        _schoolDomain = State(initialValue: user.school?.domain ?? "")
        _classYear = State(initialValue: user.classYear.map(String.init) ?? "")
        _company = State(initialValue: user.company ?? "")
        _bio = State(initialValue: user.bio ?? "")
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
                    TextField("About you", text: $bio, axis: .vertical)
                        .lineLimit(2...4)
                } footer: {
                    Text("One line is plenty.")
                }

                Section {
                    Picker("School", selection: $schoolDomain) {
                        Text("Not a student").tag("")
                        ForEach(schools) { school in
                            Text(school.name).tag(school.domain)
                        }
                        if !schoolDomain.isEmpty, !schools.contains(where: { $0.domain == schoolDomain }) {
                            Text(schoolDomain).tag(schoolDomain)
                        }
                    }
                    if !schoolDomain.isEmpty {
                        TextField("Class year", text: $classYear)
                            .keyboardType(.numberPad)
                    }
                    TextField("Company", text: $company)
                        .textContentType(.organizationName)
                } header: {
                    Text("School and work")
                } footer: {
                    Text("Your school puts your campus first on Discover, official events included. Company is for where you work — optional either way.")
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
            .task {
                if schools.isEmpty { schools = (try? await model.api.schools()) ?? [] }
            }
        }
        .presentationDetents([.large])
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
        let trimmedCompany = company.trimmingCharacters(in: .whitespaces)
        do {
            try await model.updateProfile(
                name: name.trimmingCharacters(in: .whitespaces),
                classYear: schoolDomain.isEmpty ? nil : Int(classYear.trimmingCharacters(in: .whitespaces)),
                bio: bio.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : bio,
                company: trimmedCompany.isEmpty ? nil : trimmedCompany,
                schoolDomain: schoolDomain)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
