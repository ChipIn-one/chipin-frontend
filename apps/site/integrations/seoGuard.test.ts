import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
    checkBuild,
    checkCspHashes,
    checkPage,
    cspScriptHashes,
    inlineScripts,
    scriptHash,
    staticImports,
} from './seoGuard';

const page = (head: string, body = '') =>
    `<!DOCTYPE html><html lang="en"><head>${head}</head><body>${body}</body></html>`;
const HEAD = '<title>ChipIn</title><meta name="description" content="Split expenses">';
const noScripts = () => undefined;

const problemsOf = (
    file: string,
    html: string,
    script: (path: string) => { size: number; imports: string[] } | undefined = noScripts,
) => checkPage({ file, html, script });

/** Scripts by path: `[gzipped size, imports]`. */
const graph = (scripts: Record<string, [number, string[]?]>) => (path: string) => {
    const entry = scripts[path];

    return entry && { size: entry[0], imports: entry[1] ?? [] };
};

const vercelJson = (scriptSrc: string) => ({
    headers: [
        {
            source: '/(.*)',
            headers: [
                {
                    key: 'Content-Security-Policy',
                    value: `default-src 'self'; script-src ${scriptSrc}`,
                },
            ],
        },
    ],
});

describe('seoGuard checkPage', () => {
    test('passes a page with a title and a description', () => {
        expect(problemsOf('index.html', page(HEAD))).toEqual([]);
    });

    test.each([
        ['no title', page('<meta name="description" content="x">'), 'missing <title>'],
        [
            'an empty title',
            page('<title> </title><meta name="description" content="x">'),
            'missing <title>',
        ],
        ['no description', page('<title>ChipIn</title>'), 'missing <meta name="description">'],
        [
            'an empty description',
            page('<title>ChipIn</title><meta name="description" content="">'),
            'missing <meta name="description">',
        ],
    ])('fails on %s', (_, html, problem) => {
        expect(problemsOf('ru/index.html', html)).toEqual([`ru/index.html: ${problem}`]);
    });

    test.each([
        'inviteToken',
        'refreshToken=1',
        'sessionStorage',
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig',
    ])('fails on token-like content %s', content => {
        expect(problemsOf('index.html', page(HEAD, `<p>${content}</p>`))).toEqual([
            'index.html: token-like or session content in the HTML',
        ]);
    });

    // A-15: the invite token must not reach analytics.
    test.each(['/_vercel/insights/script.js', '/_vercel/speed-insights/script.js'])(
        'fails on %s under join/ only',
        src => {
            const html = page(HEAD, `<script defer src="${src}"></script>`);
            const size = () => ({ size: 100, imports: [] });

            expect(problemsOf('join/group/index.html', html, size)).toEqual([
                'join/group/index.html: analytics script on an invite page',
            ]);
            expect(problemsOf('index.html', html, size)).toEqual([]);
        },
    );

    test.each(['<style>p{}</style>', '<p style="color:red">x</p>'])(
        'fails on inline style %s',
        html => {
            expect(problemsOf('index.html', page(HEAD, html))).toEqual([
                "index.html: inline style (build.inlineStylesheets must stay 'never')",
            ]);
        },
    );

    test('counts every same-origin script and its static imports once against 30 KB gzip', () => {
        const html = page(
            `${HEAD}<link rel="modulepreload" href="/_astro/a.js">`,
            '<script type="module" src="/_astro/a.js"></script><script src="/_astro/b.js"></script>' +
                '<script src="https://cdn.example/x.js"></script>',
        );
        const scripts: Record<string, [number, string[]?]> = {
            '/_astro/a.js': [10 * 1024, ['/_astro/shared.js']],
            '/_astro/b.js': [10 * 1024, ['/_astro/shared.js']],
            '/_astro/shared.js': [10 * 1024, ['/_astro/a.js']],
        };

        expect(problemsOf('index.html', html, graph(scripts))).toEqual([]);
        scripts['/_astro/shared.js'] = [10 * 1024 + 1];
        expect(problemsOf('index.html', html, graph(scripts))).toEqual([
            'index.html: 30721 B of JS gzipped, budget 30720 B',
        ]);
    });

    test('counts inline scripts against the budget', () => {
        const big = Array.from({ length: 9000 }, (_, i) => `v${i * 7919}`).join(';');

        expect(problemsOf('index.html', page(HEAD, `<script>${big}</script>`))).toEqual([
            expect.stringMatching(/^index\.html: \d+ B of JS gzipped, budget 30720 B$/),
        ]);
    });

    test('names like inviteToken are allowed inside a script, not in the page text', () => {
        expect(problemsOf('index.html', page(HEAD, '<script>var inviteToken;</script>'))).toEqual(
            [],
        );
        expect(problemsOf('index.html', page(HEAD, '<p>inviteToken</p>'))).toEqual([
            'index.html: token-like or session content in the HTML',
        ]);
    });

    test.each([
        ['<button onclick="go()">x</button>', 'inline event handler attribute'],
        ['<a href="javascript:go()">x</a>', 'javascript: URL'],
        [
            '<astro-island client="load"></astro-island>',
            'island without client:visible or client:idle',
        ],
        [
            '<astro-island client="only"></astro-island>',
            'island without client:visible or client:idle',
        ],
        ['<!-- accessToken -->', 'token-like or session content in the HTML'],
        [
            '<script type="application/ld+json">{"accessToken":1}</script>',
            'token-like or session content in the HTML',
        ],
    ])('fails on %s', (html, problem) => {
        expect(problemsOf('index.html', page(HEAD, html))).toEqual([`index.html: ${problem}`]);
    });

    test('allows islands with client:visible and client:idle', () => {
        const html = page(
            HEAD,
            '<astro-island client="visible"></astro-island><astro-island client="idle"></astro-island>',
        );

        expect(problemsOf('index.html', html)).toEqual([]);
    });

    test('reads handlers in markup only, not inside script bodies', () => {
        expect(
            problemsOf('index.html', page(HEAD, '<script>if (i <n onload=1) {}</script>')),
        ).toEqual([]);
    });

    test('fails on a script that is not in the build', () => {
        expect(
            problemsOf('index.html', page(HEAD, '<script src="/_astro/gone.js"></script>')),
        ).toEqual(['index.html: script /_astro/gone.js is not in the build']);
    });
});

describe('seoGuard scripts', () => {
    test('hashes every executable inline script, whatever the case of its type', () => {
        const html = page(
            HEAD,
            '<script>a()</script><script type=" Module ">b()</script>' +
                '<script type="text/ecmascript">c()</script>' +
                '<script type="application/ld+json">{}</script><script src="/x.js"></script>',
        );

        expect(inlineScripts(html)).toEqual(['a()', 'b()', 'c()']);
    });

    test('end tags with whitespace still close a script', () => {
        expect(inlineScripts(page(HEAD, '<script>a()</script ><script>b()</script\n>'))).toEqual([
            'a()',
            'b()',
        ]);
        expect(problemsOf('index.html', page(HEAD, '<script>var inviteToken;</script >'))).toEqual(
            [],
        );
    });

    const HANDLER = 'index.html: inline event handler attribute';
    const JS_URL = 'index.html: javascript: URL';
    const TOKEN = 'index.html: token-like or session content in the HTML';

    test.each([
        // Removing pieces must not assemble a script that hides the following markup.
        [
            'a split script tag',
            '<scr<script></script>ipt>x</script><button onclick="go()">x</button>',
            HANDLER,
        ],
        // The browser ends this tag at the `>` of `-->`; the guard errs towards flagging it.
        ['a comment inside a tag', '<p <!-- --> onclick="go()">x</p>', HANDLER],
        // `<!<!-- -->` is a bogus comment that ends at the first `>`; the rest is live markup.
        ['a split comment opener', '<!<!-- -->-- --><button onclick="go()">x</button>', HANDLER],
        // Repeated removal would join the leftover pieces and delete the live markup between them.
        [
            'a handler after a split script tag',
            '<scr<script></script>ipt><p onclick="go()"></script>',
            HANDLER,
        ],
        ['a handler after a split comment opener', '<!<!-- -->-- <p onclick="go()"> -->', HANDLER],
        [
            'a javascript: URL after a split comment opener',
            '<!<!-- -->-- <a href="javascript:go()">x</a> -->',
            JS_URL,
        ],
        [
            'token text after a split script tag',
            '<scr<script></script>ipt><p>inviteToken</p></script>',
            TOKEN,
        ],
        [
            'a custom element named like a script',
            '<script-x type="x"><p onclick="go()"></p></script-x>',
            HANDLER,
        ],
    ])('removing scripts and comments keeps the live markup: %s', (_name, body, problem) => {
        expect(problemsOf('index.html', page(HEAD, body))).toEqual([problem]);
    });

    // #820: the guard reads the page as the browser parses it (parse5), so markup that a text scan
    // reads as a comment, a script or an attribute value cannot hide live markup.
    test.each([
        ['a bogus comment around a comment opener', '<!<!-- ><p onclick="go()"> -->'],
        [
            'a processing instruction around a comment opener',
            '<?x <!-- ?><p onclick="go()"><!-- -->',
        ],
        ['an abruptly closed empty comment', '<!--><p onclick="go()"><!-- x -->'],
        ['an abruptly closed comment with a dash', '<!---><p onclick="go()"><!-- x -->'],
        ['a comment closed by --!>', '<!-- a --!><p onclick="go()"><!-- b -->'],
        [
            'comment markers inside attribute values',
            '<b title="<!--"><p onclick="go()"></p><i title="-->">',
        ],
        [
            'a script start tag inside a comment',
            '<!-- <script> --><p onclick="go()"></p><i></script>',
        ],
        ...['textarea', 'title', 'style', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript'].map(
            (element): [string, string] => [
                `a script start tag inside <${element}>`,
                `<${element}><script></${element}><p onclick="go()"></p></script>`,
            ],
        ),
        ['an SVG element', '<svg><a onclick="go()"></a></svg>'],
        ['a handler inside <template>', '<template><p onclick="go()"></p></template>'],
    ])('finds a handler the browser sees: %s', (_name, body) => {
        expect(problemsOf('index.html', page(HEAD, body))).toContain(HANDLER);
    });

    test.each([
        ['an entity in the scheme', '<a href="&#106;avascript:go()">x</a>'],
        ['a tab in the scheme', '<a href="java&#9;script:go()">x</a>'],
        ['a leading control character', '<a href="&#1;javascript:go()">x</a>'],
        [
            'a script start tag inside a comment',
            '<!-- <script> --><a href="javascript:go()">x</a></script>',
        ],
    ])('finds a javascript: URL the browser sees: %s', (_name, body) => {
        expect(problemsOf('index.html', page(HEAD, body))).toEqual([JS_URL]);
    });

    test.each([
        ['an entity in the name', '<p>invite&#84;oken</p>'],
        [
            'comment markers inside attribute values',
            '<b title="<!--"><p>inviteToken</p><i title="-->">',
        ],
        [
            'a script start tag inside <textarea>',
            '<textarea><script></textarea><p>inviteToken</p></script>',
        ],
    ])('finds token text the browser shows: %s', (_name, body) => {
        expect(problemsOf('index.html', page(HEAD, body))).toEqual([TOKEN]);
    });

    test('hashes only the scripts the browser parses as scripts', () => {
        const html = page(
            HEAD,
            '<!-- <script>a()</script> --><textarea><script>b()</script></textarea>' +
                '<b title="<script>c()</script>"></b><script>d()</script>' +
                '<template><script>e()</script></template><svg><script>f()</script></svg>',
        );

        expect(inlineScripts(html)).toEqual(['d()', 'e()', 'f()']);
    });

    // R1 of #820: markup the tree builder drops or the scripting-on parse hides is still live in a
    // browser (customizable <select>, <noscript> with JS off, SVG href over xlink:href).
    const STYLE = "index.html: inline style (build.inlineStylesheets must stay 'never')";
    const ISLAND = 'index.html: island without client:visible or client:idle';

    test.each([
        [
            'tags inside <select>',
            '<select><style>p{}</style><div style="color:red">x</div>' +
                '<astro-island client="load"></astro-island></select>',
            [STYLE, ISLAND],
        ],
        [
            'a handler inside <select>',
            '<select><!--><p onclick="go()">x</p><!-- x --></select>',
            [HANDLER],
        ],
        [
            'an SVG <select> resetting the insertion mode',
            '<svg><select><desc><table></table><style>p{}</style></desc></select></svg>',
            [STYLE],
        ],
        [
            'a handler after an SVG <select>',
            '<!--><svg><select><desc><table></table><img src="/x" onerror="go()"><!-- x -->',
            [HANDLER],
        ],
        ['a <style> inside <noscript>', '<noscript><style>p{}</style></noscript>', [STYLE]],
        [
            'a style attribute inside <noscript>',
            '<noscript><p style="color:red">x</p></noscript>',
            [STYLE],
        ],
        [
            'an SVG href next to xlink:href',
            '<!--><svg><a xlink:href="/x" href="javascript:go()"><text>x</text></a></svg><!-- x -->',
            [JS_URL],
        ],
        [
            'a handler inside <iframe srcdoc>',
            '<iframe srcdoc="&lt;p onclick=&quot;go()&quot;&gt;x&lt;/p&gt;"></iframe>',
            [HANDLER],
        ],
    ])('finds markup the browser runs: %s', (_name, body, problems) => {
        expect(problemsOf('index.html', page(HEAD, body))).toEqual(problems);
    });

    test('<noscript> in the head is checked with scripting off', () => {
        expect(
            problemsOf('index.html', page(`${HEAD}<noscript><style>p{}</style></noscript>`)),
        ).toEqual([STYLE]);
    });

    test('hashes import maps, speculation rules and srcdoc scripts; not other languages', () => {
        const html = page(
            HEAD,
            '<script type="importmap">{}</script><script type="speculationrules">{}</script>' +
                '<script language="vbscript">a</script><script language="javascript">b()</script>' +
                '<script type="" language="vbscript">c()</script>' +
                '<iframe srcdoc="&lt;script&gt;d()&lt;/script&gt;"></iframe>',
        );

        expect(inlineScripts(html)).toEqual(['{}', '{}', 'b()', 'c()', 'd()']);
    });

    test('a script in another language ships as text', () => {
        expect(
            problemsOf(
                'index.html',
                page(HEAD, '<script language="vbscript">refreshToken</script>'),
            ),
        ).toEqual([TOKEN]);
    });

    test('an SVG script with href loads a file, it is not inline', () => {
        const html = page(HEAD, '<svg><script href="/_astro/a.js"></script></svg>');

        expect(inlineScripts(html)).toEqual([]);
        expect(problemsOf('index.html', html)).toEqual([
            'index.html: script /_astro/a.js is not in the build',
        ]);
    });

    test('a <title> or description inside <template> does not count', () => {
        expect(
            problemsOf(
                'index.html',
                page('<template><title>x</title><meta name="description" content="x"></template>'),
            ),
        ).toEqual(['index.html: missing <title>', 'index.html: missing <meta name="description">']);
    });

    test('a removed comment does not join the pieces of an attribute name', () => {
        expect(problemsOf('index.html', page(HEAD, '<p on<!-- -->click="go()">x</p>'))).toEqual([]);
    });

    test('a "<!--" inside a script does not hide the following scripts', () => {
        const html = page(HEAD, '<script>var s="<!--"</script><script>evil()</script><p>--></p>');

        expect(inlineScripts(html)).toEqual(['var s="<!--"', 'evil()']);
    });

    test('resolves static imports of a built module to URL paths', () => {
        const code =
            'import{a as b}from"./chunk.js";import "/_astro/side.js";export*from"../x/y.js";' +
            'import("./lazy.js");import x from "https://cdn.example/z.js";';

        expect(staticImports('/_astro/page.js', code)).toEqual([
            '/_astro/chunk.js',
            '/_astro/side.js',
            '/x/y.js',
        ]);
    });
});

describe('seoGuard CSP hashes', () => {
    test('reads the script-src hashes of the CSP on /(.*)', () => {
        const hash = scriptHash('a()');

        expect(cspScriptHashes(vercelJson(`'self' ${hash}`))).toEqual([hash]);
        expect(cspScriptHashes(vercelJson("'self'"))).toEqual([]);
    });

    test('fails without a CSP, or with more than one CSP rule', () => {
        const csp = { key: 'Content-Security-Policy', value: "script-src 'self'" };

        expect(() => cspScriptHashes({ headers: [] })).toThrow('exactly one');
        expect(() =>
            cspScriptHashes({
                headers: [
                    { source: '/(.*)', headers: [csp] },
                    { source: '/join/(.*)', headers: [csp] },
                ],
            }),
        ).toThrow('exactly one');
        expect(() =>
            cspScriptHashes({
                headers: [
                    { source: '/(.*)', headers: [csp] },
                    { source: '/join/(.*)', headers: [{ ...csp, key: 'content-security-policy' }] },
                ],
            }),
        ).toThrow('exactly one');
    });

    test('matches the sha256 of an inline script against the CSP both ways', () => {
        const hash = scriptHash('a()');

        // Known value: printf 'a()' | openssl dgst -sha256 -binary | base64
        expect(hash).toBe("'sha256-qVpDBgj7bpq5hMAcGp3AOc79J3Y1Z4HvySTwKrWDoy4='");
        expect(checkCspHashes(['a()'], [hash])).toEqual([]);
        expect(checkCspHashes(['a()'], [])).toEqual([
            `inline script ${hash} is missing from the vercel.json CSP script-src`,
        ]);
        expect(checkCspHashes([], [hash])).toEqual([
            `vercel.json CSP script-src has ${hash}, no inline script matches it`,
        ]);
    });
});

describe('seoGuard checkBuild', () => {
    let dist = '';

    afterEach(() => {
        rmSync(dist, { recursive: true, force: true });
    });

    test('checks every HTML file of dist and the CSP hashes of their inline scripts', async () => {
        dist = mkdtempSync(join(tmpdir(), 'seo-guard-'));
        mkdirSync(join(dist, 'ru'));
        mkdirSync(join(dist, '_astro'));
        writeFileSync(join(dist, '_astro', 'a.js'), 'console.log(1)');
        writeFileSync(
            join(dist, 'index.html'),
            page(HEAD, '<script type="module" src="/_astro/a.js"></script>'),
        );
        writeFileSync(
            join(dist, 'ru', 'index.html'),
            page('<title>x</title>', '<script>a()</script>'),
        );

        expect(await checkBuild(dist, vercelJson("'self'"))).toEqual([
            'ru/index.html: missing <meta name="description">',
            `inline script ${scriptHash('a()')} is missing from the vercel.json CSP script-src`,
        ]);
        expect(await checkBuild(dist, vercelJson(`'self' ${scriptHash('a()')}`))).toEqual([
            'ru/index.html: missing <meta name="description">',
        ]);
    });
});
