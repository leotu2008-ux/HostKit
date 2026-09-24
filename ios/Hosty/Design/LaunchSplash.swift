import SwiftUI

/// The launch splash, matching the website's: a black screen, the Hosty
/// mark pops in (0.6 → 1.05 → 1.0 while fading in), holds, and the whole
/// overlay fades away to reveal Home. Once per app launch; skipped when the
/// system asks for reduced motion.
struct LaunchSplash: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var scale: CGFloat = 0.6
    @State private var logoOpacity: Double = 0
    @State private var overlayOpacity: Double = 1
    @State private var isDone = false

    var body: some View {
        if !isDone && !reduceMotion {
            ZStack {
                Color.black.ignoresSafeArea()
                Image("Logo")
                    .resizable()
                    .interpolation(.high)
                    .frame(width: 168, height: 168)
                    .clipShape(.rect(cornerRadius: 40))
                    .scaleEffect(scale)
                    .opacity(logoOpacity)
            }
            .opacity(overlayOpacity)
            .accessibilityHidden(true)
            .allowsHitTesting(overlayOpacity > 0.05)
            .transition(.identity)
            .task { await play() }
        }
    }

    private func play() async {
        // Pop in with a slight overshoot, settle, hold, then fade the whole overlay.
        withAnimation(.spring(response: 0.45, dampingFraction: 0.6)) {
            scale = 1.05
            logoOpacity = 1
        }
        try? await Task.sleep(for: .milliseconds(320))
        withAnimation(.easeOut(duration: 0.18)) { scale = 1.0 }
        try? await Task.sleep(for: .milliseconds(650))
        withAnimation(.easeOut(duration: 0.4)) { overlayOpacity = 0 }
        try? await Task.sleep(for: .milliseconds(420))
        isDone = true
    }
}
