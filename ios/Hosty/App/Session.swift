import Foundation
import Security

/// A draft this device made before signing in. The token is what lets the
/// phone keep managing it; publishing hands it to the signed-in host.
nonisolated struct DraftClaim: Codable, Hashable, Sendable {
    let id: String
    let token: String
}

/// Where the saved server address, sign-in and drafts live. Plain storage
/// with no UI state, so App Intents running outside the app's views can use
/// it too.
nonisolated enum Session {
    static let defaultServer = URL(string: "https://tryhosty.app")!

    // Stored on users' devices, so these keep their pre-rebrand names on purpose.
    private static let serverKey = "hostkit.serverURL"
    private static let userKey = "hostkit.user"
    private static let draftsKey = "hostkit.drafts"
    private static let cityKey = "hostkit.city"

    /// The city Discover opens on: chosen by the host, or detected once from
    /// the phone's location. Empty string means "Everywhere" was chosen.
    static var city: String? {
        get { UserDefaults.standard.string(forKey: cityKey) }
        set {
            if let newValue {
                UserDefaults.standard.set(newValue, forKey: cityKey)
            } else {
                UserDefaults.standard.removeObject(forKey: cityKey)
            }
        }
    }
    // Stored on users' devices, so these keep their pre-rebrand names on purpose.
    private static let tokenAccount = "hostkit.apiToken"
    private static let remindersKey = "hostkit.remindersEnabled"
    private static let calendarKey = "hostkit.calendarEnabled"
    private static let calendarEntriesKey = "hostkit.calendarEntries"

    /// Reminders the evening before and an hour before events you're going to. On by default.
    static var remindersEnabled: Bool {
        get { UserDefaults.standard.object(forKey: remindersKey) as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: remindersKey) }
    }

    /// Add events you register for to the calendar. On by default.
    static var calendarEnabled: Bool {
        get { UserDefaults.standard.object(forKey: calendarKey) as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: calendarKey) }
    }

    /// Home's "Are you a student?" nudge, shown once to accounts with no school.
    /// Stored on users' devices, so the key keeps its pre-rebrand name on purpose.
    static var schoolPromptDismissed: Bool {
        get { UserDefaults.standard.bool(forKey: "hostkit.schoolPromptDismissed") }
        set { UserDefaults.standard.set(newValue, forKey: "hostkit.schoolPromptDismissed") }
    }

    /// Event id → calendar entry identifier, so a night is only added once.
    static var calendarEntries: [String: String] {
        get { UserDefaults.standard.dictionary(forKey: calendarEntriesKey) as? [String: String] ?? [:] }
        set { UserDefaults.standard.set(newValue, forKey: calendarEntriesKey) }
    }

    static var serverURL: URL {
        get {
            UserDefaults.standard.string(forKey: serverKey).flatMap(URL.init(string:)) ?? defaultServer
        }
        set { UserDefaults.standard.set(newValue.absoluteString, forKey: serverKey) }
    }

    static var user: HostUser? {
        get {
            UserDefaults.standard.data(forKey: userKey)
                .flatMap { try? JSONDecoder().decode(HostUser.self, from: $0) }
        }
        set {
            if let newValue, let data = try? JSONEncoder().encode(newValue) {
                UserDefaults.standard.set(data, forKey: userKey)
            } else {
                UserDefaults.standard.removeObject(forKey: userKey)
            }
        }
    }

    static var drafts: [DraftClaim] {
        get {
            UserDefaults.standard.data(forKey: draftsKey)
                .flatMap { try? JSONDecoder().decode([DraftClaim].self, from: $0) } ?? []
        }
        set {
            if newValue.isEmpty {
                UserDefaults.standard.removeObject(forKey: draftsKey)
            } else if let data = try? JSONEncoder().encode(Array(newValue.prefix(20))) {
                UserDefaults.standard.set(data, forKey: draftsKey)
            }
        }
    }

    static func rememberDraft(_ draft: DraftClaim) {
        drafts = [draft] + drafts.filter { $0.id != draft.id }
    }

    static func forgetDrafts(_ ids: [String]) {
        drafts = drafts.filter { !ids.contains($0.id) }
    }

    static var token: String? {
        get { Keychain.read(account: tokenAccount) }
        set {
            if let newValue {
                Keychain.write(newValue, account: tokenAccount)
            } else {
                Keychain.delete(account: tokenAccount)
            }
        }
    }

    static func client() -> APIClient {
        APIClient(baseURL: serverURL, token: token, drafts: drafts)
    }
}

/// The API token is a credential, so it goes in the Keychain rather than
/// UserDefaults.
nonisolated enum Keychain {
    private static let service = "app.hostkit.ios"

    static func read(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func write(_ value: String, account: String) {
        delete(account: account)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
            kSecValueData as String: Data(value.utf8),
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    static func delete(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
