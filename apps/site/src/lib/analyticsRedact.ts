// The invite token never reaches web analytics (spec 04 §3.6, KB USR-084). Invite pages load no
// analytics; on every page this inline script stands before the analytics scripts and queues a
// `beforeSend` for Vercel Web Analytics (`va`) and Speed Insights (`si`) that replaces the token in
// the reported URL. Its sha256 is in the CSP of vercel.json (seoGuard and vercel.config.test.ts).

/**
 * The token segment of an invite path, site form (`/join/group/<t>`) and the old app form
 * (`/group/join/<t>`, `/friends/join/<t>`), any case: a mistyped link falls to the 404 page, which
 * loads analytics. Every match is replaced; the query and the fragment stay.
 */
const INVITE_PATH = /\/(join\/(?:group|friend)|(?:group|friends)\/join)\/[^/?#]+/gi;
const REDACTED = '/$1/[token]';

/** What the inline script does to a reported URL. */
const redactInviteUrl = (url: string): string => url.replace(INVITE_PATH, REDACTED);

// Classic script text, served verbatim: changing it changes its CSP hash.
const ANALYTICS_REDACT_SCRIPT = [
    '(function () {',
    '    var w = window;',
    '    w.va = w.va || function () { (w.vaq = w.vaq || []).push(arguments); };',
    '    w.si = w.si || function () { (w.siq = w.siq || []).push(arguments); };',
    '    var redact = function (event) {',
    "        if (!event || typeof event.url !== 'string') return event;",
    '        return Object.assign({}, event, {',
    `            url: event.url.replace(${INVITE_PATH.toString()}, '${REDACTED}'),`,
    '        });',
    '    };',
    "    w.va('beforeSend', redact);",
    "    w.si('beforeSend', redact);",
    '})();',
].join('\n');

export { ANALYTICS_REDACT_SCRIPT, redactInviteUrl };
