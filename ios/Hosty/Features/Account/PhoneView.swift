import SwiftUI

/// Add a mobile number: type it, get a text, type the code.
struct PhoneView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var phone = ""
    @State private var code = ""
    @State private var started: PhoneStart?
    @State private var isBusy = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            if let started {
                Section {
                    TextField("6-digit code", text: $code)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .font(.inter(.title2, .semibold))
                        .onChange(of: code) { _, value in
                            code = String(value.filter(\.isNumber).prefix(6))
                        }
                    Button {
                        Task { await verify() }
                    } label: {
                        HStack {
                            Text("Verify")
                            if isBusy { Spacer(); ProgressView() }
                        }
                    }
                    .disabled(code.count != 6 || isBusy)
                    Button("Send again") { Task { await start() } }
                        .disabled(isBusy)
                } header: {
                    Text("Enter the code")
                } footer: {
                    if let devCode = started.devCode {
                        Text("We texted \(PhoneFormat.pretty(started.phone)). No SMS service on this server — your code is \(devCode).")
                    } else {
                        Text("We texted \(PhoneFormat.pretty(started.phone)). It expires in 10 minutes.")
                    }
                }
            } else {
                Section {
                    TextField("(617) 555-0100", text: $phone)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                    Button {
                        Task { await start() }
                    } label: {
                        HStack {
                            Text("Text me a code")
                            if isBusy { Spacer(); ProgressView() }
                        }
                    }
                    .disabled(phone.filter(\.isNumber).count < 10 || isBusy)
                } header: {
                    Text("Mobile number")
                } footer: {
                    Text("Hosts of events you register for can see this number. Confirmed with a text.")
                }
            }
            if let errorMessage {
                Section { Text(errorMessage).foregroundStyle(.red) }
            }
        }
        .navigationTitle("Phone number")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func start() async {
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do {
            started = try await model.startPhone(started?.phone ?? phone)
            code = ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func verify() async {
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do {
            try await model.verifyPhone(code: code)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// Mirrors `formatPhone` in lib/phone.ts.
enum PhoneFormat {
    static func pretty(_ e164: String) -> String {
        let digits = e164.filter(\.isNumber)
        if e164.hasPrefix("+1"), digits.count == 11 {
            let d = Array(digits.dropFirst())
            return "(\(String(d[0..<3]))) \(String(d[3..<6]))-\(String(d[6..<10]))"
        }
        return e164
    }
}
