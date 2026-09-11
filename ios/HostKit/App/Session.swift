import Foundation
import Security

/// Where the saved server address and sign-in live. Plain storage with no
/// UI state, so App Intents running outside the app's views can use it too.
nonisolated enum Session {
    static let defaultServer = URL(string: "https://host-kit-one.vercel.app")!

    private static let serverKey = "hostkit.serverURL"
    private static let userKey = "hostkit.user"
    private static let tokenAccount = "hostkit.apiToken"

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
        APIClient(baseURL: serverURL, token: token)
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
