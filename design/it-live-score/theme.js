/* Browser-only helper. Load once before first paint where the host's CSP permits.
   SSR frameworks: adapt to their server cookie / hydration conventions.
   API: ITLiveTheme.set("light" | "dark" | "system")
   Read: ITLiveTheme.preference, ITLiveTheme.resolved
   Event: window "itlive:themechange" detail { preference, resolved } */
(function () {
  "use strict";
  if (typeof window === "undefined" || window.ITLiveTheme) return;
  const key = "itlive-score-theme";
  const valid = new Set(["light", "dark", "system"]);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = "system";
  try {
    const saved = window.localStorage.getItem(key);
    if (valid.has(saved)) preference = saved;
  } catch (_) { /* Storage unavailable: keep session preference. */ }
  let resolved;
  function apply() {
    resolved = preference === "system" ? (media.matches ? "dark" : "light") : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    window.dispatchEvent(new CustomEvent("itlive:themechange", { detail: { preference, resolved } }));
  }
  window.ITLiveTheme = Object.freeze({
    get preference() { return preference; },
    get resolved() { return resolved; },
    set(next) {
      if (!valid.has(next)) throw new TypeError("Theme must be light, dark, or system");
      preference = next;
      try { window.localStorage.setItem(key, next); } catch (_) {}
      apply();
    }
  });
  media.addEventListener("change", function () { if (preference === "system") apply(); });
  window.addEventListener("storage", function (event) {
    if (event.key !== key && event.key !== null) return;
    preference = valid.has(event.newValue) ? event.newValue : "system";
    apply();
  });
  apply();
})();

