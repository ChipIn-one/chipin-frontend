/**
 * The current value of a `--cp-*` token (spec 05 §3), for APIs that do not resolve `var()`, such
 * as a canvas `fillStyle`. Reads the root element, where tokens.css declares the tokens.
 */
const cssToken = (name: `--cp-${string}`): string =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export { cssToken };
