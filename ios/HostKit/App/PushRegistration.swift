import UIKit
import UserNotifications

/// Remote notifications, gated: the app only asks iOS for a device token
/// when Info.plist has `HostKitPushEnabled = true`, which is set together
/// with the Push Notifications capability and the aps-environment
/// entitlement once a paid developer team exists. Until then this class
/// does nothing, and reminders stay local.
final class PushRegistration: NSObject, UIApplicationDelegate {
    static var isEnabled: Bool {
        (Bundle.main.object(forInfoDictionaryKey: "HostKitPushEnabled") as? Bool) ?? false
    }

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = ForegroundBanners.shared
        if Self.isEnabled {
            application.registerForRemoteNotifications()
        }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { try? await Session.client().registerPushToken(token) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Expected on the simulator and on builds without the entitlement.
    }
}
