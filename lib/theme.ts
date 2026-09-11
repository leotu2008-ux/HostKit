export const THEME_COOKIE = "hostkit-theme";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function parsePreference(raw: string | null | undefined): ThemePreference {
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): ResolvedTheme {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return systemDark ? "dark" : "light";
}

const DARK_PAPER = "#161310";
const LIGHT_PAPER = "#fbf8f4";

export function paperFor(theme: ResolvedTheme): string {
  return theme === "dark" ? DARK_PAPER : LIGHT_PAPER;
}

/** Runs before first paint so the paper/night tokens match the saved choice. */
export const THEME_BOOTSTRAP = `(function(){
  try {
    var key = "${THEME_COOKIE}";
    var root = document.documentElement;
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      var stored = localStorage.getItem(key);
      var cookie = document.cookie.split("; ").find(function(p){ return p.indexOf(key+"=")===0; });
      var raw = stored || (cookie ? decodeURIComponent(cookie.slice(key.length+1)) : "");
      var pref = raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
      var theme = pref === "dark" || (pref === "system" && mq.matches) ? "dark" : "light";
      root.dataset.theme = theme;
      root.dataset.themePref = pref;
      root.style.colorScheme = theme;
    }
    apply();
    mq.addEventListener("change", function() {
      if (root.dataset.themePref === "system") apply();
    });
  } catch (e) {}
})();`;
