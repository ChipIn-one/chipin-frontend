import { DEFAULT_LOCALE } from '../i18n/locales';

import { INVITE_APP_PATHS, INVITE_TOKEN_PATTERN } from './inviteToken';

// The inline script of the invite landing (spec 04 §3.5, KB USR-080..USR-083). The page renders the
// texts of every locale, each block hidden but the default one; the script:
// 1. takes the kind and the token from `location.pathname` (`/join/<kind>/<token>`, rewritten by
//    vercel.json to the page of that kind) and checks the token with the app's regex;
// 2. picks the first of `navigator.languages` the page has a block for, `DEFAULT_LOCALE` otherwise;
// 3. shows the "Open invitation" link to the app (an explicit table of app paths, the token
//    URI-encoded, `?locale=<code>`) for a valid token, "The link is broken" otherwise. It never
//    navigates by itself.
// The app origin comes from the page (`data-app-origin`, PUBLIC_APP_ORIGIN at build time), so the
// script text, and with it its CSP hash in vercel.json, is the same on every host.
const JOIN_SCRIPT = [
    '(function () {',
    "    var root = document.querySelector('[data-join]');",
    '    if (!root) {',
    '        return;',
    '    }',
    `    var paths = ${JSON.stringify(INVITE_APP_PATHS)};`,
    "    var kind = root.getAttribute('data-kind');",
    '    var match = /^\\/join\\/(group|friend)\\/([^/]+)\\/?$/.exec(location.pathname);',
    '    var token = null;',
    '    if (match && match[1] === kind && Object.prototype.hasOwnProperty.call(paths, kind)) {',
    '        try {',
    '            token = decodeURIComponent(match[2]);',
    '        } catch (error) {',
    '            token = null;',
    '        }',
    '    }',
    `    var valid = token !== null && ${INVITE_TOKEN_PATTERN.toString()}.test(token);`,
    "    var blocks = Array.prototype.slice.call(root.querySelectorAll('[data-locale]'));",
    '    var codes = blocks.map(function (block) {',
    "        return block.getAttribute('data-locale');",
    '    });',
    '    var preferred = navigator.languages && navigator.languages.length',
    '        ? navigator.languages',
    "        : [navigator.language || ''];",
    `    var locale = '${DEFAULT_LOCALE}';`,
    '    for (var i = 0; i < preferred.length; i += 1) {',
    "        var code = String(preferred[i]).toLowerCase().split('-')[0];",
    '        if (codes.indexOf(code) !== -1) {',
    '            locale = code;',
    '            break;',
    '        }',
    '    }',
    '    blocks.forEach(function (block) {',
    "        var current = block.getAttribute('data-locale') === locale;",
    '        block.hidden = !current;',
    '        if (!current) {',
    '            return;',
    '        }',
    '        var state = block.querySelector(valid ? \'[data-state="valid"]\' : \'[data-state="invalid"]\');',
    '        if (state) {',
    '            state.hidden = false;',
    '        }',
    "        var link = block.querySelector('[data-open-invite]');",
    '        if (valid && link) {',
    '            link.href =',
    "                root.getAttribute('data-app-origin') +",
    '                paths[kind] +',
    '                encodeURIComponent(token) +',
    "                '?locale=' +",
    '                encodeURIComponent(locale);',
    '        }',
    '    });',
    '})();',
].join('\n');

export { JOIN_SCRIPT };
