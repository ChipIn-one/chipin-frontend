// The anti-FOUC theme script (spec 05 §2). It runs as the first element of `<head>`, before any
// CSS or app code, and sets the `light`/`dark` class on `<html>` from the saved preference.
// It is inlined as is, so its text is the CSP hash input: any edit changes
// THEME_INIT_SCRIPT_SHA256 (theme-init.test.ts fails and prints the new value), and the CSP
// `script-src` of apps/app/vercel.json must get the same hash (05-3).
//
// The key duplicates LS_KEY_THEME (`Chipin_theme`) of the app; the stored value is the raw
// string `light` | `dark` | `system` (the format next-themes wrote).

export const THEME_INIT_SCRIPT = `(function () {
    var theme = 'light';
    try {
        var saved = localStorage.getItem('Chipin_theme');
        var system = saved === null || saved === 'system';
        if (saved === 'dark' || (system && matchMedia('(prefers-color-scheme: dark)').matches)) {
            theme = 'dark';
        }
    } catch (error) {
        theme = 'light';
    }
    var root = document.documentElement;
    root.classList.add(theme);
    root.style.colorScheme = theme;
})();`;

/** The CSP source for THEME_INIT_SCRIPT: `'sha256-…'` goes into `script-src`. */
export const THEME_INIT_SCRIPT_SHA256 = 'sha256-csvYgt4QHyi37935f6OISh43lFcujwqd2YA+fdnDPOc=';
