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
        ['<astro-island client="load"></astro-island>', 'island with client:load'],
    ])('fails on %s', (html, problem) => {
        expect(problemsOf('index.html', page(HEAD, html))).toEqual([`index.html: ${problem}`]);
    });

    test('allows islands with client:visible', () => {
        expect(
            problemsOf('index.html', page(HEAD, '<astro-island client="visible"></astro-island>')),
        ).toEqual([]);
    });

    test('fails on a script that is not in the build', () => {
        expect(
            problemsOf('index.html', page(HEAD, '<script src="/_astro/gone.js"></script>')),
        ).toEqual(['index.html: script /_astro/gone.js is not in the build']);
    });
});

describe('seoGuard scripts', () => {
    test('hashes only executable inline scripts outside comments', () => {
        const html = page(
            HEAD,
            '<script>a()</script><script type="module">b()</script>' +
                '<script type="application/ld+json">{}</script><!-- <script>c()</script> -->' +
                '<script src="/x.js"></script>',
        );

        expect(inlineScripts(html)).toEqual(['a()', 'b()']);
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
