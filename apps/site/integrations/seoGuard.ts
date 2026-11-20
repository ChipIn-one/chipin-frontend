import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import type { AstroIntegration } from 'astro';

// Build gate of the site (spec 04 §3.2, §3.6), moved from the app's prerender-public.mjs: it runs
// on `astro:build:done` and fails the build on the first page that breaks a rule.

/** JS budget per page, gzipped (§3.6). */
const JS_BUDGET_GZ_BYTES = 30 * 1024;

// Session data or tokens must never be rendered into public HTML (prerender-public.mjs).
const FORBIDDEN_CONTENT = [
    /(?:refreshToken|accessToken|inviteToken|sessionStorage)/i,
    // A JWT: base64url header `{"…` and payload.
    /eyJ[\w-]{10,}\.[\w-]{10,}/,
];

const ANALYTICS_SCRIPT = /_vercel\/(?:insights|speed-insights)/;

type Attributes = Map<string, string>;

const parseAttributes = (source: string): Attributes => {
    const attributes: Attributes = new Map();

    for (const match of source.matchAll(
        /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g,
    )) {
        const [, name, double, single, bare] = match;

        if (name) {
            attributes.set(name.toLowerCase(), double ?? single ?? bare ?? '');
        }
    }
    return attributes;
};

const tags = (html: string, name: string): Attributes[] =>
    [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'gi'))].map(match =>
        parseAttributes(match[1] ?? ''),
    );

/** The text of every `<script>` without `src` (the CSP hash input). */
const inlineScripts = (html: string): string[] =>
    [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
        .filter(match => !parseAttributes(match[1] ?? '').has('src'))
        .map(match => match[2] ?? '');

/** The CSP source of an inline script: `'sha256-…'`. */
const scriptHash = (text: string): string =>
    `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/** Same-origin scripts a page loads: `<script src>` and `<link rel="modulepreload">`. */
const localScriptPaths = (html: string): string[] => {
    const sources = [
        ...tags(html, 'script').map(attributes => attributes.get('src')),
        ...tags(html, 'link')
            .filter(attributes => attributes.get('rel') === 'modulepreload')
            .map(attributes => attributes.get('href')),
    ];

    return [...new Set(sources.filter((src): src is string => !!src && /^\/(?!\/)/.test(src)))];
};

interface PageInput {
    /** Path inside `dist`, `/`-separated (`ru/index.html`). */
    file: string;
    html: string;
    /** The gzipped size of a same-origin script by its URL path; `undefined` if it is missing. */
    scriptSize: (path: string) => number | undefined;
}

/** The rule violations of one built page. */
const checkPage = ({ file, html, scriptSize }: PageInput): string[] => {
    const problems: string[] = [];
    const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();
    const description = tags(html, 'meta')
        .find(attributes => attributes.get('name') === 'description')
        ?.get('content')
        ?.trim();

    if (!title) {
        problems.push(`${file}: missing <title>`);
    }
    if (!description) {
        problems.push(`${file}: missing <meta name="description">`);
    }
    if (FORBIDDEN_CONTENT.some(pattern => pattern.test(html))) {
        problems.push(`${file}: token-like or session content in the HTML`);
    }
    // The invite token must not reach analytics (A-15).
    if (file.startsWith('join/') && ANALYTICS_SCRIPT.test(html)) {
        problems.push(`${file}: analytics script on an invite page`);
    }
    // The site CSP has `style-src 'self'` (§3.6): no inline styles.
    if (/<style\b/i.test(html) || /\sstyle\s*=/i.test(html)) {
        problems.push(`${file}: inline style (build.inlineStylesheets must stay 'never')`);
    }

    let jsBytes = 0;

    for (const path of localScriptPaths(html)) {
        const size = scriptSize(path);

        if (size === undefined) {
            problems.push(`${file}: script ${path} is not in the build`);
        } else {
            jsBytes += size;
        }
    }
    if (jsBytes > JS_BUDGET_GZ_BYTES) {
        problems.push(`${file}: ${jsBytes} B of JS gzipped, budget ${JS_BUDGET_GZ_BYTES} B`);
    }
    return problems;
};

interface HeaderRule {
    source?: unknown;
    has?: unknown;
    headers?: { key?: unknown; value?: unknown }[];
}

/** The `script-src` hashes of the CSP that `vercel.json` sends on every path. */
const cspScriptHashes = (vercelJson: unknown): string[] => {
    const rules =
        typeof vercelJson === 'object' && vercelJson !== null && 'headers' in vercelJson
            ? (vercelJson.headers as HeaderRule[])
            : [];
    const csp = rules
        .filter(rule => rule.source === '/(.*)' && rule.has === undefined)
        .flatMap(rule => rule.headers ?? [])
        .find(header => header.key === 'Content-Security-Policy')?.value;

    if (typeof csp !== 'string') {
        throw new Error('vercel.json: no Content-Security-Policy on /(.*)');
    }
    const scriptSrc = csp
        .split(';')
        .map(directive => directive.trim().split(/\s+/))
        .find(([name]) => name === 'script-src');

    return (scriptSrc ?? []).filter(source => source.startsWith("'sha256-"));
};

/** Every inline script of the build has its hash in the CSP, and the CSP has no stale hash. */
const checkCspHashes = (inline: readonly string[], cspHashes: readonly string[]): string[] => {
    const built = new Set(inline.map(scriptHash));
    const committed = new Set(cspHashes);

    return [
        ...[...built]
            .filter(hash => !committed.has(hash))
            .map(hash => `inline script ${hash} is missing from the vercel.json CSP script-src`),
        ...[...committed]
            .filter(hash => !built.has(hash))
            .map(hash => `vercel.json CSP script-src has ${hash}, no inline script matches it`),
    ];
};

const listFiles = async (dir: string): Promise<string[]> => {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });

    return entries
        .filter(entry => entry.isFile())
        .map(entry => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'));
};

/** Checks the whole `dist`; returns every violation. */
const checkBuild = async (distDir: string, vercelJson: unknown): Promise<string[]> => {
    const files = await listFiles(distDir);
    const gzSizes = new Map<string, number>();

    await Promise.all(
        files
            .filter(file => /\.m?js$/.test(file))
            .map(async file => {
                gzSizes.set(`/${file}`, gzipSync(await readFile(join(distDir, file))).length);
            }),
    );

    const problems: string[] = [];
    const inline: string[] = [];

    for (const file of files.filter(name => name.endsWith('.html')).sort()) {
        const html = await readFile(join(distDir, file), 'utf8');

        problems.push(...checkPage({ file, html, scriptSize: path => gzSizes.get(path) }));
        inline.push(...inlineScripts(html));
    }
    problems.push(...checkCspHashes(inline, cspScriptHashes(vercelJson)));
    return problems;
};

/** Fails `astro build` if a built page breaks a rule; `vercelJson` is the committed config file. */
const seoGuard = ({ vercelJson }: { vercelJson: URL }): AstroIntegration => ({
    name: 'chipin:seo-guard',
    hooks: {
        'astro:build:done': async ({ dir, logger }) => {
            const config: unknown = JSON.parse(await readFile(vercelJson, 'utf8'));
            const problems = await checkBuild(fileURLToPath(dir), config);

            if (problems.length > 0) {
                throw new Error(`seoGuard: ${problems.length} problem(s)\n${problems.join('\n')}`);
            }
            logger.info('all pages pass');
        },
    },
});

export {
    checkBuild,
    checkCspHashes,
    checkPage,
    cspScriptHashes,
    inlineScripts,
    scriptHash,
    seoGuard,
};
