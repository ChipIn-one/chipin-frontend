import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import type { AstroIntegration } from 'astro';

// Build gate of the site (spec 04 §3.2, §3.6), moved from the app's prerender-public.mjs: it runs
// on `astro:build:done` and fails the build on the first page that breaks a rule.

/** JS budget per page, gzipped (§3.6). */
const JS_BUDGET_GZ_BYTES = 30 * 1024;

// Session data or tokens must never be rendered into public HTML (prerender-public.mjs). The
// names are checked outside `<script>` (the 04-3c invite script may name its variables), a JWT
// everywhere.
const FORBIDDEN_TEXT = /(?:refreshToken|accessToken|inviteToken|sessionStorage)/i;
// A JWT: base64url header `{"…` and payload.
const JWT = /eyJ[\w-]{10,}\.[\w-]{10,}/;

// End tags may carry whitespace or junk before `>` (`</script >`), as HTML parsers accept. The
// name ends at whitespace, `/` or `>`: `<script-x>` is a custom element, not a script.
const SCRIPT_ELEMENT = /<script(?=[\s/>])([^>]*)>([\s\S]*?)<\/script(?=[\s/>])[^>]*>/gi;
const COMMENT = /<!--[\s\S]*?-->/g;

// `type` values a browser executes (compared lowercased and trimmed).
const JS_TYPES = new Set([
    '',
    'module',
    'text/javascript',
    'application/javascript',
    'text/ecmascript',
    'application/ecmascript',
    'text/x-javascript',
    'application/x-javascript',
]);

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

const isExecutable = (attributes: Attributes): boolean =>
    JS_TYPES.has((attributes.get('type') ?? '').trim().toLowerCase());

/** Every `<script>` element: attributes and body. Script bodies are cut out before markup checks. */
const scriptElements = (html: string) =>
    [...html.matchAll(SCRIPT_ELEMENT)].map(match => ({
        attributes: parseAttributes(match[1] ?? ''),
        body: match[2] ?? '',
    }));

/** The page markup without script bodies (or comments, when `comments` is false). */
const markup = (html: string, { comments }: { comments: boolean }): string => {
    // One pass, each match becomes a space: the pieces around a match stay apart, so they cannot
    // join into a new tag or attribute, and no markup between two pieces is deleted.
    const noScripts = html.replace(SCRIPT_ELEMENT, ' ');

    return comments ? noScripts : noScripts.replace(COMMENT, ' ');
};

/** The text of every executable `<script>` without `src` (the CSP hash input). */
const inlineScripts = (html: string): string[] =>
    scriptElements(html)
        .filter(({ attributes }) => !attributes.has('src') && isExecutable(attributes))
        .map(({ body }) => body);

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

interface ScriptInfo {
    /** Gzipped size in bytes. */
    size: number;
    /** URL paths of the scripts it imports statically (they load with the page). */
    imports: string[];
}

interface PageInput {
    /** Path inside `dist`, `/`-separated (`ru/index.html`). */
    file: string;
    html: string;
    /** A same-origin script of the build by its URL path; `undefined` if it is missing. */
    script: (path: string) => ScriptInfo | undefined;
}

/** Static `import`/`export … from` specifiers of a built ES module, as URL paths. */
const staticImports = (path: string, code: string): string[] =>
    [...code.matchAll(/(?:\bimport|\bexport)\s*(?:[\w$*{}\s,]+?\s*from\s*)?["']([^"']+)["']/g)]
        .map(match => match[1] ?? '')
        .filter(specifier => specifier.startsWith('/') || specifier.startsWith('.'))
        .map(specifier =>
            specifier.startsWith('/') ? specifier : posix.join(posix.dirname(path), specifier),
        );

/** The rule violations of one built page. */
const checkPage = ({ file, html, script }: PageInput): string[] => {
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
    // Executable scripts may name such variables; data scripts and comments ship as text.
    const text = [
        markup(html, { comments: true }),
        ...scriptElements(html)
            .filter(({ attributes }) => !isExecutable(attributes))
            .map(({ body }) => body),
    ].join('\n');

    if (FORBIDDEN_TEXT.test(text) || JWT.test(html)) {
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
    // The CSP blocks inline handlers and `javascript:` URLs: they would silently not work.
    const elements = [
        ...markup(html, { comments: false }).matchAll(/<[a-z][\w-]*\b([^>]*)>/gi),
    ].map(match => parseAttributes(match[1] ?? ''));

    if (elements.some(attributes => [...attributes.keys()].some(name => /^on[a-z]+$/.test(name)))) {
        problems.push(`${file}: inline event handler attribute`);
    }
    if (
        elements.some(attributes =>
            [...attributes.values()].some(value => /^\s*javascript:/i.test(value)),
        )
    ) {
        problems.push(`${file}: javascript: URL`);
    }
    // §3.6: islands hydrate only with client:visible or client:idle.
    if (
        tags(html, 'astro-island').some(
            attributes => !['visible', 'idle'].includes(attributes.get('client') ?? ''),
        )
    ) {
        problems.push(`${file}: island without client:visible or client:idle`);
    }

    // The page's scripts and everything they import statically, plus its inline scripts.
    let jsBytes = inlineScripts(html).reduce(
        (sum, text) => sum + gzipSync(Buffer.from(text, 'utf8')).length,
        0,
    );
    const seen = new Set<string>();
    const queue = localScriptPaths(html);

    for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
        if (seen.has(path)) {
            continue;
        }
        seen.add(path);
        const info = script(path);

        if (info === undefined) {
            problems.push(`${file}: script ${path} is not in the build`);
        } else {
            jsBytes += info.size;
            queue.push(...info.imports);
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
    // Header names are case-insensitive.
    const isCsp = (header: { key?: unknown }): boolean =>
        typeof header.key === 'string' && header.key.toLowerCase() === 'content-security-policy';
    const cspRules = rules.filter(rule => (rule.headers ?? []).some(isCsp));
    // One CSP for every path: a per-path CSP (e.g. `/join/(.*)`) needs a per-path hash check here.
    const [rule, ...others] = cspRules;
    const csp = rule?.headers?.find(isCsp)?.value;

    if (others.length > 0 || rule?.source !== '/(.*)' || rule.has !== undefined) {
        throw new Error('vercel.json: expected exactly one Content-Security-Policy, on /(.*)');
    }
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
    const scripts = new Map<string, ScriptInfo>();

    await Promise.all(
        files
            .filter(file => /\.m?js$/.test(file))
            .map(async file => {
                const code = await readFile(join(distDir, file));
                const path = `/${file}`;

                scripts.set(path, {
                    size: gzipSync(code).length,
                    imports: staticImports(path, code.toString('utf8')),
                });
            }),
    );

    const problems: string[] = [];
    const inline: string[] = [];

    for (const file of files.filter(name => name.endsWith('.html')).sort()) {
        const html = await readFile(join(distDir, file), 'utf8');

        problems.push(...checkPage({ file, html, script: path => scripts.get(path) }));
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
    staticImports,
};
