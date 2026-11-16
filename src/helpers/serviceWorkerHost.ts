// Spec 04 §2.11 (04-4a1, D30): the legacy hosts serve a kill-switch at /sw.js, so no page there may
// register a worker, otherwise the landing would register, the kill-switch would unregister and
// reload the window, and the landing would register again. Exact hostnames only: previews
// (*.vercel.app), localhost and the app hosts (app.chipin.one, app-dev.chipin.one) keep registering.
const LEGACY_HOSTNAMES: ReadonlySet<string> = new Set(['chipin.one', 'dev.chipin.one']);

/** False on the legacy hosts `chipin.one` and `dev.chipin.one`, true on every other host. */
export const shouldRegisterServiceWorker = (hostname: string): boolean =>
    !LEGACY_HOSTNAMES.has(hostname.toLowerCase().replace(/\.$/, ''));
