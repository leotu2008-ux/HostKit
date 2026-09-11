/** sessionStorage flag so the launch splash plays once per tab session. */
export const SPLASH_STORAGE_KEY = "hostkit-splash-seen";

/**
 * Whether this visit should play the fade in / hold / fade out splash.
 * Reduced motion skips it so the app is there on first paint.
 */
export function shouldPlaySplash(
  seen: boolean,
  reducedMotion: boolean,
): boolean {
  return !seen && !reducedMotion;
}

/**
 * Runs before first paint (same slot as the theme bootstrap) so returning
 * visitors and reduced-motion users never flash a black overlay.
 */
export const SPLASH_BOOTSTRAP = `(function(){
  try {
    var root = document.documentElement;
    var seen = false;
    try { seen = sessionStorage.getItem("${SPLASH_STORAGE_KEY}") === "1"; } catch (e) {}
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) {
      root.dataset.splash = "done";
      if (reduce && !seen) {
        try { sessionStorage.setItem("${SPLASH_STORAGE_KEY}", "1"); } catch (e) {}
      }
    } else {
      root.dataset.splash = "pending";
    }
  } catch (e) {
    document.documentElement.dataset.splash = "done";
  }
})();`;
