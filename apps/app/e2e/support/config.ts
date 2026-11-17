// Target and credential resolution for the Playwright smoke (docs/e2e-tests.md). Pure functions of
// the environment: playwright.config.ts calls `resolveE2eTarget` while loading, so a forbidden
// target fails before the web server, the global setup or any request starts.

export interface E2eEnvironment {
    CHIPIN_E2E_BASE_URL?: string;
    CHIPIN_CONTRACT_SWAGGER_USER?: string;
    CHIPIN_CONTRACT_SWAGGER_PASSWORD?: string;
    VERCEL_AUTOMATION_BYPASS_SECRET?: string;
}

export interface E2eTarget {
    /** The app origin the browser opens, without a trailing slash. */
    baseUrl: string;
    /** `local-dev-server`: no target was given, Playwright starts `vite` itself. */
    kind: 'local-dev-server' | 'local' | 'vercel-preview';
}

export interface E2eBasicAuth {
    username: string;
    password: string;
}

/** The only API the suite provisions against. The production API is never a target. */
export const STAGING_API_ORIGIN = 'https://api-dev.chipin.one';

/**
 * The one provisioning run of this test run. CI sets it before the run, so the workflow can purge
 * the run even after a cancel, timeout or crash; a missing or malformed value is replaced by a
 * fresh id in the global setup, which passes it to the workers.
 */
export const E2E_RUN_ID_VARIABLE = 'CHIPIN_E2E_RUN_ID';

/**
 * Written by the global teardown into the output folder (its content: the run id) only after the
 * verifying purge found no user of the run left. CI uploads artifacts only when it is present.
 */
export const E2E_PURGE_MARKER_FILE = '.purge-verified';

/** The origin of the Vite dev server that Playwright starts when no target is given. */
export const LOCAL_DEV_SERVER_PORT = 5173;
export const LOCAL_DEV_SERVER_ORIGIN = `http://localhost:${LOCAL_DEV_SERVER_PORT}`;

// Production app, site and API hosts: rejected with their own message, whatever the scheme or port.
const PRODUCTION_HOSTNAMES = new Set([
    'chipin.one',
    'www.chipin.one',
    'app.chipin.one',
    'api.chipin.one',
]);
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);
// Vercel Preview deployments of this project only: `chipin-frontend-<hash>-sylliks-projects` and
// the branch alias `chipin-frontend-git-<branch>-sylliks-projects` under `.vercel.app`.
const VERCEL_PREVIEW_HOSTNAME =
    /^chipin-frontend-[a-z0-9]+(?:-[a-z0-9]+)*-sylliks-projects\.vercel\.app$/;

const parseTargetUrl = (value: string): URL => {
    try {
        return new URL(value);
    } catch {
        throw new Error('E2E target CHIPIN_E2E_BASE_URL must be an absolute URL');
    }
};

export const resolveE2eTarget = (environment: E2eEnvironment): E2eTarget => {
    const rawBaseUrl = environment.CHIPIN_E2E_BASE_URL?.trim();

    if (!rawBaseUrl) {
        return { baseUrl: LOCAL_DEV_SERVER_ORIGIN, kind: 'local-dev-server' };
    }

    const targetUrl = parseTargetUrl(rawBaseUrl);

    if (PRODUCTION_HOSTNAMES.has(targetUrl.hostname)) {
        throw new Error('Production e2e target is forbidden');
    }

    if (targetUrl.username || targetUrl.password) {
        throw new Error('E2E target must not contain user info');
    }

    if (targetUrl.search || targetUrl.hash) {
        throw new Error('E2E target must not contain query or fragment');
    }

    if (targetUrl.pathname !== '/') {
        throw new Error('E2E target must use the origin root');
    }

    if (targetUrl.protocol === 'http:' && LOCAL_HOSTNAMES.has(targetUrl.hostname)) {
        return { baseUrl: targetUrl.origin, kind: 'local' };
    }

    const isVercelPreview =
        targetUrl.protocol === 'https:' &&
        targetUrl.port === '' &&
        VERCEL_PREVIEW_HOSTNAME.test(targetUrl.hostname);

    if (isVercelPreview) {
        return { baseUrl: targetUrl.origin, kind: 'vercel-preview' };
    }

    throw new Error(
        'E2E target is not allowlisted (local http origin or https chipin-frontend-*-sylliks-projects.vercel.app)',
    );
};

export const resolveE2eBasicAuth = (environment: E2eEnvironment): E2eBasicAuth => {
    const username = environment.CHIPIN_CONTRACT_SWAGGER_USER;
    const password = environment.CHIPIN_CONTRACT_SWAGGER_PASSWORD;

    if (!username?.trim() || !password?.trim()) {
        throw new Error(
            'E2E provisioning requires the staging Basic credentials CHIPIN_CONTRACT_SWAGGER_USER and CHIPIN_CONTRACT_SWAGGER_PASSWORD',
        );
    }

    return { password, username };
};

/** Vercel's header for Protection Bypass for Automation. */
export const VERCEL_BYPASS_HEADER = 'x-vercel-protection-bypass';

export interface PreviewBypass {
    /** Requests to exactly this origin get the header; no other host ever does. */
    origin: string;
    headers: Record<string, string>;
}

/**
 * The optional Vercel deployment-protection bypass: only for a Vercel Preview target and only when
 * the secret is set (an unprotected Preview needs none). It is sent per request to the Preview
 * origin, never through `extraHTTPHeaders`, which would also reach other hosts.
 */
export const resolvePreviewBypass = (
    environment: E2eEnvironment,
    target: E2eTarget,
): PreviewBypass | null => {
    const secret = environment.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();

    if (!secret || target.kind !== 'vercel-preview') {
        return null;
    }

    return { origin: target.baseUrl, headers: { [VERCEL_BYPASS_HEADER]: secret } };
};

/** Whether `url` is a request to the bypass origin (scheme, host and port all equal). */
export const isPreviewOriginRequest = (bypass: PreviewBypass, url: string): boolean => {
    try {
        return new URL(url).origin === bypass.origin;
    } catch {
        return false;
    }
};

/** The e2e variables of `process.env` (Node: the Playwright config, global setup and workers). */
export const readE2eEnvironment = (): E2eEnvironment => {
    const read = (key: keyof E2eEnvironment): string | undefined => {
        const value = process.env[key];

        return typeof value === 'string' ? value : undefined;
    };

    return {
        CHIPIN_E2E_BASE_URL: read('CHIPIN_E2E_BASE_URL'),
        CHIPIN_CONTRACT_SWAGGER_USER: read('CHIPIN_CONTRACT_SWAGGER_USER'),
        CHIPIN_CONTRACT_SWAGGER_PASSWORD: read('CHIPIN_CONTRACT_SWAGGER_PASSWORD'),
        VERCEL_AUTOMATION_BYPASS_SECRET: read('VERCEL_AUTOMATION_BYPASS_SECRET'),
    };
};
