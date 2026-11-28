// The screen and flow manifest (#997): `docs/design-system/screens.md` describes it; the data is
// `docs/design-system/screens.manifest.json`. This module is its schema and reader, imported by
// the unit test (`app/router/screenManifest.test.ts`) and by Playwright captures (`apps/app/e2e`,
// relative import, as `e2e/support/fixtures.ts` imports `src/constants`). It imports only zod: no
// path aliases, no Node or browser globals, so both tsconfig projects can type-check it.
import { z } from 'zod';

/**
 * Path of the manifest data relative to the repository root (not to the working directory or this
 * module): resolve it against the root, or use {@link SCREEN_MANIFEST_URL}.
 */
export const SCREEN_MANIFEST_FILE = 'docs/design-system/screens.manifest.json';

// From `apps/app/src/test/` up to the repository root. A variable, not a literal: Vite rewrites
// `new URL('<literal>', import.meta.url)` into an asset import.
const FROM_MODULE_TO_MANIFEST = `../../../../${SCREEN_MANIFEST_FILE}`;

/** The manifest data as a `file:` URL resolved from this module: `readFileSync(SCREEN_MANIFEST_URL)`. */
export const SCREEN_MANIFEST_URL = new URL(FROM_MODULE_TO_MANIFEST, import.meta.url);

/** `group`, `group.empty`, `modal.add-expense.default`: kebab-case segments joined by dots. */
export const SCREEN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

const screenId = z.string().regex(SCREEN_ID_PATTERN);
const theme = z.enum(['light', 'dark']);
const width = z.union([z.literal(390), z.literal(1440)]);

/** A Playwright `page.route` / `context.route` mock: the URL is a Playwright glob. */
const mockSchema = z.strictObject({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ANY']),
    url: z.string().min(1),
    /** `fulfill` answers `status` (and `body`), `abort` fails the request, `hang` never answers. */
    action: z.enum(['fulfill', 'abort', 'hang']),
    status: z.int().min(100).max(599).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    /** A JSON body for `fulfill`. */
    body: z.unknown().optional(),
});

const setupSchema = z.strictObject({
    /** A `scenarios[].id`: the staging users and data, created with the provisioning client. */
    scenario: z.string().optional(),
    /** The Playwright fixture that opens the page (`signIn(userA)`, `page`). */
    fixture: z.string().optional(),
    mocks: z.array(mockSchema).optional(),
    /** `context.setOffline(true)` after the steps (the cache of the loaded page stays). */
    offline: z.boolean().optional(),
    /** A browser context user agent (the in-app browser notice). */
    userAgent: z.string().optional(),
    /**
     * UI steps after `goto(path)`, in order: prose that names an e2e helper
     * (`openGroupTab(page, groupId, 'Settings')`) or a visible label (`click Remove group`, as in
     * the `en` locale). The capture (#998) maps each one to a helper or a locator.
     */
    steps: z.array(z.string().min(1)).optional(),
});

const screenSchema = z
    .strictObject({
        id: screenId,
        app: z.enum(['app', 'site']),
        /** An `APP_ROUTES` id (`app` rows). */
        routeId: z.string().optional(),
        /** A file under `apps/site/src/pages`, as `join/friend.astro` (`site` rows). */
        sitePage: z.string().optional(),
        /** The URL to open: the route pattern with `:params` and an optional query. */
        path: z.string().startsWith('/'),
        kind: z.enum(['screen', 'modal', 'state']),
        /** The row this one is reached from (required for `modal` and `state`). */
        parent: screenId.optional(),
        auth: z.enum(['anonymous', 'signed-in', 'session-expired']),
        /** Subsets of the manifest defaults, when a row is checked in fewer variants. */
        themes: z.array(theme).min(1).optional(),
        widths: z.array(width).min(1).optional(),
        /** `manual`: not reachable by the automatic capture (see `notes`). */
        capture: z.enum(['auto', 'manual']).default('auto'),
        setup: setupSchema,
        notes: z.string().optional(),
    })
    .superRefine((screen, context) => {
        if (screen.app === 'app' && (screen.routeId === undefined || screen.sitePage)) {
            context.addIssue({
                code: 'custom',
                message: `${screen.id}: an app row needs a routeId and no sitePage`,
            });
        }
        if (screen.app === 'site' && (screen.sitePage === undefined || screen.routeId)) {
            context.addIssue({
                code: 'custom',
                message: `${screen.id}: a site row needs a sitePage and no routeId`,
            });
        }
        if (screen.kind === 'screen' && screen.parent !== undefined) {
            context.addIssue({
                code: 'custom',
                message: `${screen.id}: a screen must not have a parent`,
            });
        }
        if (screen.kind !== 'screen' && screen.parent === undefined) {
            context.addIssue({
                code: 'custom',
                message: `${screen.id}: a ${screen.kind} needs a parent`,
            });
        }
    });

const excludedSchema = z.union([
    z.strictObject({ routeId: z.string(), reason: z.string().min(1) }),
    z.strictObject({ sitePage: z.string(), reason: z.string().min(1) }),
    /** A router path that is not an `APP_ROUTES` entry (the `*` catch-all). */
    z.strictObject({ routePath: z.string(), reason: z.string().min(1) }),
    /** A modal or screen component that no user can reach today. */
    z.strictObject({ component: z.string(), reason: z.string().min(1) }),
]);

const scenarioSchema = z.strictObject({
    id: z.string().regex(SCREEN_ID_PATTERN),
    description: z.string().min(1),
    /** Calls of the provisioning client (`e2e/support/provisioning.ts`), in order. */
    provisioning: z.array(z.string().min(1)),
});

const flowSchema = z.strictObject({
    id: z.string().regex(SCREEN_ID_PATTERN),
    title: z.string().min(1),
    steps: z.array(screenId).min(2),
});

const duplicates = (values: readonly string[]): string[] =>
    values.filter((value, index) => values.indexOf(value) !== index);

export const screenManifestSchema = z
    .strictObject({
        version: z.literal(1),
        themes: z.array(theme).min(1),
        widths: z.array(width).min(1),
        scenarios: z.array(scenarioSchema),
        screens: z.array(screenSchema).min(1),
        excluded: z.array(excludedSchema),
        flows: z.array(flowSchema),
    })
    .superRefine((manifest, context) => {
        const ids = manifest.screens.map(screen => screen.id);
        const known = new Set(ids);
        const scenarios = new Set(manifest.scenarios.map(scenario => scenario.id));
        const fail = (message: string) => context.addIssue({ code: 'custom', message });

        for (const id of duplicates(ids)) {
            fail(`duplicate screen id: ${id}`);
        }
        for (const id of duplicates(manifest.flows.map(flow => flow.id))) {
            fail(`duplicate flow id: ${id}`);
        }
        for (const id of duplicates(manifest.scenarios.map(scenario => scenario.id))) {
            fail(`duplicate scenario id: ${id}`);
        }
        for (const screen of manifest.screens) {
            if (screen.parent !== undefined && !known.has(screen.parent)) {
                fail(`${screen.id}: unknown parent ${screen.parent}`);
            }
            const { scenario } = screen.setup;
            if (scenario !== undefined && !scenarios.has(scenario)) {
                fail(`${screen.id}: unknown scenario ${scenario}`);
            }
        }
        // Walking up from every row must end at a screen: a parent chain never loops.
        const parentOf = new Map(manifest.screens.map(screen => [screen.id, screen.parent]));
        for (const id of ids) {
            const seen = new Set<string>();
            let current: string | undefined = id;
            while (current !== undefined && !seen.has(current)) {
                seen.add(current);
                current = parentOf.get(current);
            }
            if (current !== undefined) {
                fail(`${id}: parent cycle through ${current}`);
            }
        }
        // A route or page is either mapped or excluded, never both (a stale exclusion).
        const rowTargets = new Set(
            manifest.screens.flatMap(screen => [screen.routeId, screen.sitePage]),
        );
        for (const entry of manifest.excluded) {
            const target =
                'routeId' in entry ? entry.routeId : 'sitePage' in entry ? entry.sitePage : null;
            if (target !== null && rowTargets.has(target)) {
                fail(`excluded ${target} also has a row`);
            }
        }
        for (const flow of manifest.flows) {
            for (const step of flow.steps) {
                if (!known.has(step)) {
                    fail(`flow ${flow.id}: unknown step ${step}`);
                }
            }
        }
    });

export type ScreenManifest = z.infer<typeof screenManifestSchema>;
export type ScreenEntry = ScreenManifest['screens'][number];
export type ScreenMock = z.infer<typeof mockSchema>;
export type ScreenFlow = ScreenManifest['flows'][number];
export type ScreenExclusion = ScreenManifest['excluded'][number];

/** Validates parsed JSON (`JSON.parse` of {@link SCREEN_MANIFEST_FILE}); throws a ZodError. */
export const parseScreenManifest = (json: unknown): ScreenManifest =>
    screenManifestSchema.parse(json);

/** The theme x width variants a row is captured in (its own subsets, else the defaults). */
export const screenVariants = (
    manifest: ScreenManifest,
    screen: ScreenEntry,
): { theme: 'light' | 'dark'; width: 390 | 1440 }[] =>
    (screen.themes ?? manifest.themes).flatMap(themeName =>
        (screen.widths ?? manifest.widths).map(widthValue => ({
            theme: themeName,
            width: widthValue,
        })),
    );
