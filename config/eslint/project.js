import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import pluginQuery from '@tanstack/eslint-plugin-query';
import importX from 'eslint-plugin-import-x';

import { appGlob, ASTRO_FILES, LINT_FILES } from './base.js';
import { TEST_FILES } from './layers.js';

// In flat config a later block replaces the options of `no-restricted-syntax` /
// `no-restricted-imports` for the files it matches, so separate blocks silently drop each
// other's entries. All entries of one rule are therefore passed to ONE helper call
// (`restrictedSyntax()` / `restrictedImports()`, wired once in eslint.config.js); modules only
// contribute entry lists.
//
// Entry: { id, message, files?, ignores?, pending?, astro?, ...rule fields }. `files`/`ignores` are globs
// (each glob is one "scope"); an entry applies to a file that matches one of its `files` (or to
// every file when `files` is absent) and none of its `ignores`. Every message is prefixed with
// `[id]`; the id is the registry key `<rule>#<id>` in config/eslint/rule-classes.json.
// `pending: true` marks an entry whose globs match no file yet (e.g. `src/money/**` before the
// money module exists): scripts/check-rule-registry.mjs then does not report its key as dead.
// Their `<rule>#<id>` keys are kept on each block under the PENDING_IDS symbol, which ESLint ignores.
// `astro: false` keeps an entry off `.astro` files (React/app-only JSX selectors would otherwise
// match the Astro template, which astro-eslint-parser parses as JSX).
export const PENDING_IDS = Symbol.for('chipin.eslint.pendingIds');

// 2^n block pairs per rule. 7 since 05-5: `no-restricted-imports` had 6 layer/money scopes and the
// styled-components allowlist needs its own one.
const MAX_SCOPES = 7;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const validateEntries = (ruleName, entries) => {
    const ids = new Set();

    for (const entry of entries) {
        if (!ID_PATTERN.test(entry.id ?? '') || ids.has(entry.id)) {
            throw new Error(`${ruleName}: missing, invalid or duplicate entry id "${entry.id}"`);
        }
        if (!entry.message) {
            throw new Error(`${ruleName}#${entry.id}: a message that says how to fix is required`);
        }
        ids.add(entry.id);
    }
};

const appliesTo = (entry, scopes) =>
    (!entry.files || entry.files.some(glob => scopes.has(glob))) &&
    !(entry.ignores ?? []).some(glob => scopes.has(glob));

// All combinations of scopes, smallest first: a file's last matching block is the one whose
// scope set equals exactly the scopes the file is in, so its options are exactly right.
const scopeCombinations = scopes =>
    scopes
        .reduce((combos, scope) => [...combos, ...combos.map(combo => [...combo, scope])], [[]])
        .sort((left, right) => left.length - right.length);

const scopedBlocks = (ruleName, entries, toOptions) => {
    validateEntries(ruleName, entries);
    const scopes = [...new Set(entries.flatMap(e => [...(e.files ?? []), ...(e.ignores ?? [])]))];

    if (scopes.length > MAX_SCOPES) {
        throw new Error(`${ruleName}: ${scopes.length} scopes; merge globs (max ${MAX_SCOPES})`);
    }
    if (entries.length === 0) {
        return [];
    }

    const block = (combo, kind, files, active) => ({
        name: `chipin/${ruleName}${kind}/${combo.join(' & ') || 'all'}`,
        files: [[files, ...combo]],
        rules: { [ruleName]: active.length > 0 ? ['error', ...toOptions(active)] : 'off' },
        [PENDING_IDS]: active
            .filter(entry => entry.pending)
            .map(entry => `${ruleName}#${entry.id}`),
    });

    return scopeCombinations(scopes).flatMap(combo => {
        const active = entries.filter(entry => appliesTo(entry, new Set(combo)));

        // `.astro` files (frontmatter and template) get every entry except `astro: false` ones
        // (React/app-only JSX entries); their client scripts match LINT_FILES as virtual files.
        return [
            block(combo, '', LINT_FILES, active),
            block(
                combo,
                '/astro',
                ASTRO_FILES,
                active.filter(entry => entry.astro !== false),
            ),
        ];
    });
};

const withId = entry => `[${entry.id}] ${entry.message}`;

/**
 * `no-restricted-syntax` entries: { id, selector, message, files?, ignores? }.
 * @param {Array<{ id: string, selector: string, message: string, files?: string[], ignores?: string[] }>} entries
 */
export const restrictedSyntax = entries =>
    scopedBlocks('no-restricted-syntax', entries, active =>
        active.map(entry => ({ selector: entry.selector, message: withId(entry) })),
    );

/**
 * `no-restricted-imports` entries: { id, message, files?, ignores?, path } for an exact module
 * name, or { id, message, files?, ignores?, pattern } with `no-restricted-imports` pattern fields
 * (`regex`/`group`, `allowTypeImports`, `allowImportNamePattern`, ...).
 */
export const restrictedImports = entries =>
    scopedBlocks('no-restricted-imports', entries, active => {
        const paths = active
            .filter(entry => entry.path)
            .map(entry => ({ name: entry.path, message: withId(entry) }));
        const patterns = active
            .filter(entry => entry.pattern)
            .map(entry => ({ ...entry.pattern, message: withId(entry) }));

        return [{ paths, patterns }];
    });

/** Repository-relative paths of the files that may still import styled-components (spec 05 §3). */
export const STYLED_ALLOWLIST_PATH = 'config/eslint/styled-components-allowlist.json';

const readStyledAllowlist = () =>
    JSON.parse(readFileSync(resolve(import.meta.dirname, '../..', STYLED_ALLOWLIST_PATH), 'utf8'));

/** One glob for a list of paths: a single scope of the restricted-entry helpers. */
export const pathsGlob = paths => (paths.length === 1 ? paths[0] : `{${paths.join(',')}}`);

/** ChipIn `no-restricted-imports` entries that are not layer boundaries. */
export const projectImports = ({ appDir = '.', styledAllowlist = readStyledAllowlist() } = {}) => [
    {
        // spec 05 §3: no new styled-components; the allowlisted files only leave the list
        // (scripts/check-styled-allowlist.mjs). No `files` glob: the scope limit; outside
        // apps/app/src nothing imports it either.
        id: 'styled-components',
        path: 'styled-components',
        ...(styledAllowlist.length > 0 ? { ignores: [pathsGlob(styledAllowlist)] } : {}),
        message:
            'No new styled-components: style with Radix props, then a CSS Module (`Component.module.css`, `var(--cp-*)`).',
    },
    {
        // spec 05 §3: `@radix-ui/colors` is a phantom (transitive) dependency; its only importer,
        // constants/styled-themes.ts, is gone. Colors come only from @chipin/tokens.
        id: 'radix-colors',
        pattern: { regex: '^@radix-ui/colors(?:/|$)' },
        message:
            'Do not import @radix-ui/colors: use a `var(--cp-*)` token from @chipin/tokens, or `PROP_COLOR` for a Radix `color` prop.',
    },
    {
        // spec 05 §6: svgr (`?react`) only for the brand marks logo.svg and google-icon.svg (used
        // by mode-logotype and AuthButtons.tsx). Allowlisted by the imported asset, not the
        // importing file: no scope left for an ignore glob.
        id: 'svgr-react',
        pattern: {
            regex: '^(?!(?:@chipin/tokens/assets/logo|assets/google-icon)\\.svg\\?react$).*\\.svg\\?react$',
        },
        message: 'Use a lucide-react icon (`<Name>Icon`); svgr is only for the brand marks.',
    },
    {
        // lucide-react icons are imported only by their `<Name>Icon` export (no `Lucide<Name>`
        // aliases, no bare names, no namespace import): one import surface for icons.
        id: 'lucide-icon-names',
        pattern: {
            regex: '^lucide-react$',
            allowImportNamePattern: '^(?:(?!Lucide)[A-Z][A-Za-z0-9]*Icon|LucideIcon|LucideProps)$',
        },
        message: 'Import lucide-react icons by their `<Name>Icon` export (e.g. `UsersIcon`).',
    },
    {
        // spec 03 §4.3: shared/money has one public entry, its index.ts.
        id: 'money-deep-import',
        pattern: { group: ['shared/money/*'] },
        message: 'Import from shared/money only (its index.ts is the public API).',
    },
    {
        // spec 03 §4.3 (C1-11): WireAmount <-> Money conversion happens only in the
        // entities/*/model mappers `toX()`/`toXWire()`; the transport and the rest never convert.
        // One ignore glob (the scope limit of restrictedImports): the mappers, the money module
        // itself and every test.
        id: 'money-wire-conversion',
        pattern: {
            // The alias and any relative path to the money folder, with or without a subpath
            // (`../../shared/money/index`, `../money/wireMoney`).
            regex: '^(?:shared/money|(?:\\.\\.?/)+(?:[^/]+/)*money)(?:/.*)?$',
            importNames: ['moneyFromWire', 'moneyToWire'],
        },
        ignores: [
            appGlob(appDir, '{src/entities/*/model/**,src/shared/money/**,**/*.test.{ts,tsx}}'),
        ],
        message:
            'Wire<->Money conversion only in entities/*/model mappers (toX()/toXWire()); pass the WireAmount there.',
    },
];

// Money (spec 03 §4.3, the only definition of these rules): heuristic by property names, a safety
// net behind the `Money`/`WireAmount` types. Applies to app sources outside the money module and
// the non-money number formatter; tests are exempt. Non-money exceptions use
// `// eslint-disable-next-line no-restricted-syntax -- not money: <reason>`.
const moneyScope = appDir => ({
    files: [appGlob(appDir, 'src/**/*.{ts,tsx}')],
    // The test glob is the one of the i18n attribute entry (react.js): one scope, not two.
    ignores: [appGlob(appDir, 'src/shared/{money/**,lib/formatNumber.ts}'), '**/*.test.{ts,tsx}'],
});

const FIELD_WRAPPERS = ['', 'ChainExpression > ', 'TSNonNullExpression > '];

// A money field as a direct operand of `parent`: `x.amount`, `x?.amount` (ChainExpression) and
// `x.amount!` (TSNonNullExpression). With `defaulted`, also a side of a `??`/`||` operand:
// `(x?.amount ?? 0) > 1`.
const fieldOperand = (parent, names, { defaulted = false } = {}) =>
    (defaulted
        ? [
              ...FIELD_WRAPPERS,
              ...FIELD_WRAPPERS.map(w => `LogicalExpression[operator=/^(\\?\\?|\\|\\|)$/] > ${w}`),
          ]
        : FIELD_WRAPPERS
    )
        .map(wrapper => `${parent} > ${wrapper}MemberExpression[property.name=/^(${names})$/]`)
        .join(', ');

/** ChipIn `no-restricted-syntax` entries (money: spec 03-1, colors/styles: spec 05-5). */
export const projectSyntax = ({ appDir }) =>
    [
        {
            id: 'money-parse-float',
            // `parseFloat(x)` and `Number.parseFloat(x)`.
            selector:
                "CallExpression[callee.name='parseFloat'], CallExpression[callee.property.name='parseFloat']",
            message: 'Money: use shared/money (parseMoneyInput/moneyFromWire).',
        },
        {
            id: 'money-number-field',
            selector: fieldOperand(
                "CallExpression[callee.name='Number']",
                'amount|minor|netBalance|netAmount|shareAmount',
            ),
            message: 'Money: no Number() on money fields; read them with moneyFromWire.',
        },
        {
            id: 'money-to-fixed',
            selector: "CallExpression[callee.property.name='toFixed']",
            message: 'Money: use formatMoney/roundToMinor from shared/money.',
        },
        {
            id: 'money-math-round',
            selector:
                "CallExpression[callee.object.name='Math'][callee.property.name='round'] BinaryExpression[operator='*']",
            message: 'Money: no Math.round(x*N) rounding; use roundToMinor from shared/money.',
        },
        {
            id: 'money-intl-number-format',
            selector:
                "NewExpression[callee.object.name='Intl'][callee.property.name='NumberFormat']",
            message: 'Use formatMoney (shared/money) or shared/lib/formatNumber.',
        },
        {
            id: 'money-compare-field',
            selector: fieldOperand('BinaryExpression[operator=/^[<>]=?$/]', 'amount|minor', {
                defaulted: true,
            }),
            message: 'Money: compare via compare/sign from shared/money.',
        },
    ].map(entry => ({ ...entry, ...moneyScope(appDir) }));

// Zustand store hooks: `use<Name>Store(selector)` (React's `useSyncExternalStore` is not one) and
// Zustand's own `useStore(store, selector)`. Aliased hooks are out of scope.
const NAMED_STORE_HOOK =
    'CallExpression[callee.name=/^use(?!SyncExternal)[A-Z][A-Za-z0-9]*Store$/]';
const ZUSTAND_USE_STORE = "CallExpression[callee.name='useStore']";
const STORE_HOOK = `:matches(${NAMED_STORE_HOOK}, ${ZUSTAND_USE_STORE})`;
// A selector function passed straight to a store hook (not wrapped in `useShallow(...)`).
const STORE_SELECTOR = `${STORE_HOOK} > :matches(ArrowFunctionExpression, FunctionExpression)`;
// A new object/array on every call: a literal, or an expression that may evaluate to one through
// conditional branches, `??`/`||`/`&&` and type assertions (`s.list ?? []`, `s.a && { … }`,
// `c ? (d ? s.a : {}) : s.b`, `s.list ?? ([] as unknown as Item[])`, `({}) as unknown as T`), up
// to MAX_VALUE_DEPTH such nodes from the returned value down to the literal. esquery has no
// recursion, so the hops are nested `:has()` up to the depth; the returned value is the reported
// node (one report per selector). The chain does not tell a branch from a condition
// (`{} ? a : b` also matches): only nonsense code differs.
const LITERAL = 'ObjectExpression, ArrayExpression';
const VALUE_NODE =
    ':matches(ConditionalExpression, LogicalExpression, TSAsExpression, TSSatisfiesExpression)';
const MAX_VALUE_DEPTH = 6;
// esquery 1.7 parses `:has(> a > b)` as `> (a > b)`, not a two-hop chain, so each hop is its own
// `:has(> …)`. esquery evaluates the inner selector of `:has(> X)` on every descendant of the
// subject, so an unguarded nested `:has` restarts on each of them: super-polynomial on a long
// `||`/ternary chain. Ancestry inside `:has` is relative to its subject, so the guard
// `:not(* > * > *)` stops an inner hop from starting below a direct child: linear again.
const newValue = (depth, guard = '') =>
    depth === 0
        ? `:matches(${LITERAL})`
        : `:matches(${LITERAL}, ${VALUE_NODE}${guard}:has(> ${newValue(depth - 1, ':not(* > * > *)')}))`;
const NEW_VALUE = newValue(MAX_VALUE_DEPTH);
const TYPE_ASSERTION = '/^(?:TSAsExpression|TSSatisfiesExpression)$/';
// A conditional branch that is an array literal, bare or asserted (`c ? (['a'] as const) : k`).
const LITERAL_KEY_BRANCH = ['consequent', 'alternate']
    .flatMap(field => [
        `[${field}.type='ArrayExpression']`,
        `[${field}.type=${TYPE_ASSERTION}][${field}.expression.type='ArrayExpression']`,
    ])
    .join(', ');
// Where a function body returns: directly, or inside `if`/`else` (with or without braces).
const RETURN_CONTAINERS = [
    '',
    'IfStatement > ',
    'IfStatement > BlockStatement > ',
    'IfStatement > IfStatement > ',
    'IfStatement > IfStatement > BlockStatement > ',
];

// The QueryClient methods that write, remove, invalidate, cancel or fetch a cache entry
// (`pure-query-fn`).
const QUERY_CACHE_METHODS = [
    'setQueryData',
    'setQueriesData',
    'removeQueries',
    'resetQueries',
    'invalidateQueries',
    'refetchQueries',
    'cancelQueries',
    'fetchQuery',
    'prefetchQuery',
    'fetchInfiniteQuery',
    'prefetchInfiniteQuery',
    'ensureQueryData',
    'ensureInfiniteQueryData',
].join('|');

// A Radix color prop (`prop-color-roles`): `color` and any `<x>Color` (`iconColor`, `actionColor`).
const COLOR_PROP = '/^(?:color|[a-z][A-Za-z]*Color)$/';
// Every Radix Themes color name (the accent scales and the grays).
const RADIX_PALETTE_NAME =
    '/^(?:gray|mauve|slate|sage|olive|sand|gold|bronze|brown|yellow|amber|orange|tomato|red|ruby|crimson|pink|plum|purple|violet|iris|indigo|blue|cyan|teal|jade|green|grass|lime|mint|sky)$/';

/**
 * ChipIn project `no-restricted-syntax` entries (spec 02 §D0 "project"; 02-C12): images only
 * through basics/Image, Zustand reads only by a selector, an object selector only with useShallow
 * (D12). The store entries are a heuristic: derived values (`.map`/`.filter`, `Object.assign`)
 * and named selectors are not detected.
 */
export const projectRules = ({ appDir }) => [
    {
        // D11 (02-C13): one barrel per slice that names what it re-exports; no star re-exports.
        id: 'export-all',
        selector: 'ExportAllDeclaration',
        message:
            "Re-export by name: `export { X } from './X'` (or `export type { T }`), not `export *`.",
    },
    {
        // spec 04 §2.10: the UI language changes in one place, helpers/setAppLanguage.ts, which
        // loads the language's lazy chunks first. Its one call is an `eslint-disable` with the
        // reason (no new scope: MAX_SCOPES is full); tests switch the language directly.
        id: 'change-language',
        selector: "CallExpression[callee.property.name='changeLanguage']",
        ignores: ['**/*.test.{ts,tsx}'],
        message:
            'Switch the language with setAppLanguage (saves the preference) or applyLanguage from helpers/setAppLanguage.',
    },
    {
        // spec 04 §2.1 (04-2f): the site pages are not app routes; links to them are SITE_PATHS,
        // used only as `<a href>` or `window.location.assign`.
        id: 'site-paths',
        selector: "MemberExpression[object.name='ROUTES'][property.name=/^(HOME|PRIVACY|TERMS)$/]",
        message:
            'Link to the site with SITE_PATHS from helpers/sitePaths (absolute URLs, `<a href>` or `window.location.assign`), never navigate/<Link>.',
    },
    {
        id: 'img-element',
        // `<img>`, `styled.img`, `styled('img')`, `createElement('img')`, `React.createElement('img')`.
        selector: [
            "JSXOpeningElement[name.name='img']",
            "MemberExpression[object.name='styled'][property.name='img']",
            "CallExpression[callee.name='styled'][arguments.0.value='img']",
            "CallExpression[callee.name='createElement'][arguments.0.value='img']",
            "CallExpression[callee.object.name='React'][callee.property.name='createElement'][arguments.0.value='img']",
        ].join(', '),
        ignores: [appGlob(appDir, 'src/basics/Image.tsx')],
        // The site cannot import basics/Image.
        astro: false,
        message: 'Use the Image component from basics/Image instead of `<img>`/`styled.img`.',
    },
    {
        // spec 03 §1.3: query keys come only from the entity key factories.
        // Its ignore glob is the 6th of MAX_SCOPES (6/6) of `no-restricted-syntax`: a new scoped
        // entry must reuse an existing glob.
        id: 'query-key-literal',
        // `queryKey: [...]` (also `as const` / `satisfies`), `queryKey: c ? [...] : k` (a literal
        // in either branch), and a literal key as the first argument of the QueryClient methods
        // that take a key: `getQueryData([...])`, ... Limit: only a single-level conditional
        // directly on the property; `queryKey: k ?? [...]`, nested conditionals and a conditional
        // first argument (`getQueryData(c ? [...] : k)`) are not covered.
        selector: [
            ...['', 'TSAsExpression > ', 'TSSatisfiesExpression > '].flatMap(wrapper => [
                `Property[key.name='queryKey'] > ${wrapper}ArrayExpression`,
                `Property[key.name='queryKey'] > ${wrapper}ConditionalExpression:matches(${LITERAL_KEY_BRANCH})`,
            ]),
            // `:first-child` must be on the argument itself (the wrapper when there is one).
            ...['ArrayExpression', 'TSAsExpression', 'TSSatisfiesExpression'].map(
                argument =>
                    `CallExpression[callee.property.name=/^(?:getQueryData|setQueryData|getQueryState)$/] > ${argument}:first-child${argument === 'ArrayExpression' ? '' : ' > ArrayExpression'}`,
            ),
        ].join(', '),
        ignores: [appGlob(appDir, 'src/entities/*/api/queries.ts')],
        message:
            'Build query keys with the entity key factory (`dashboardKeys.all`, `groupsKeys.list()`) from entities/<entity>/api/queries.ts.',
    },
    {
        // #669 (docs/engineering/rules/50-api-data.md §Query Functions): a query function reads its
        // own resource and writes no other query cache. Unscoped (no MAX_SCOPES slot). An inline
        // `queryFn` that takes `client` from its context (`({ client }) =>`, `const { client } =
        // context`, `context.client`) or calls a QueryClient cache method. Limits (review checks
        // them): a named or passed-through `queryFn` (`queryFn: fetchX`, `ctx => helper(ctx)`) is
        // not inspected, and writes through `Query`/`QueryCache` objects (`query.setData`,
        // `cache.remove`) are not caught.
        id: 'pure-query-fn',
        selector: [
            "Property[key.name='queryFn'] > :function > ObjectPattern > Property[key.name='client']",
            "Property[key.name='queryFn'] VariableDeclarator > ObjectPattern.id > Property[key.name='client']",
            "Property[key.name='queryFn'] MemberExpression[property.name='client']",
            `Property[key.name='queryFn'] CallExpression[callee.property.name=/^(?:${QUERY_CACHE_METHODS})$/]`,
        ].join(', '),
        message:
            'A queryFn is pure: read its own resource and return it or reject; change another cache in a mutation, a read-side seed (`initialData`) or a hook effect (docs/engineering/rules/50-api-data.md §Query Functions).',
    },
    {
        // spec 05 §3 (D23): colors only as `var(--cp-*)` from @chipin/tokens. A whole-string hex
        // (anchored, so `'#add-expense'` is not one), a color function, or a palette variable;
        // the template form covers styled CSS. Not a color: `eslint-disable-next-line
        // no-restricted-syntax -- not a color: <reason>`.
        id: 'no-raw-colors',
        selector: [
            'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|\\b(?:rgba?|hsla?)\\(|var\\(--(?!cp-|_)[a-z]+-a?\\d+\\)/]',
            'TemplateElement[value.raw=/(?:^|[\\s:,(])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b|\\b(?:rgba?|hsla?)\\(|var\\(--(?!cp-|_)[a-z]+-a?\\d+\\)/]',
        ].join(', '),
        ignores: ['packages/tokens/**'],
        message: 'use var(--cp-*) from @chipin/tokens',
    },
    {
        // spec 05 §3 (#1007): a Radix color prop (`color`, `iconColor`, `actionColor`, …) takes a
        // `PROP_COLOR` role from @chipin/tokens/theme, never a palette name: a string attribute
        // (`color="red"`) or a literal anywhere in its expression (`color={on ? 'green' : 'gray'}`).
        // App sources, tests included (the `src/**/*.{ts,tsx}` glob of moneyScope: no new scope).
        // The category palette (constants/category-ui.ts) is data, not a JSX attribute: its
        // `color={item.color}` passes. Not linted: a palette name in a variable or object field.
        id: 'prop-color-roles',
        selector: [
            `JSXAttribute[name.name=${COLOR_PROP}] > Literal[value=${RADIX_PALETTE_NAME}]`,
            `JSXAttribute[name.name=${COLOR_PROP}] > JSXExpressionContainer Literal[value=${RADIX_PALETTE_NAME}]`,
        ].join(', '),
        files: [appGlob(appDir, 'src/**/*.{ts,tsx}')],
        astro: false,
        message:
            'A Radix color prop takes a role: `color={PROP_COLOR.danger}` from @chipin/tokens/theme, not a palette name (docs/design-system/tokens.md).',
    },
    {
        // spec 05 §3: `style={{…}}` only for custom properties (`style={{ '--cover-url': url }}`).
        id: 'inline-style',
        selector:
            "JSXAttribute[name.name='style'] ObjectExpression > Property:not([key.value=/^--/])",
        astro: false,
        message:
            "No inline styles: use Radix props (`p`, `width`, `position`, …), else a CSS Module; `style` takes only custom properties (`{ '--x': v }`).",
    },
    {
        id: 'store-without-selector',
        // `useXStore()` and `useStore(store)`.
        selector: `${NAMED_STORE_HOOK}[arguments.length=0], ${ZUSTAND_USE_STORE}[arguments.length<2]`,
        message:
            'Read a Zustand store through a selector: `useXStore(state => state.value)`, or several values with `useXStore(useShallow(state => ({ a: state.a })))`.',
    },
    {
        id: 'store-object-without-shallow',
        // `useXStore(s => ({ … }))`, `s => [a, b]`, `s => (c ? { … } : { … })`,
        // `s => s.list ?? []`, `s => s.x || {}`, `s => s.a && { … }`, `c ? (d ? s.a : {}) : s.b` (NEW_VALUE),
        // `useXStore(s => { return { … }; })` (also inside `if`/`else`), `useXStore({ … })`; the
        // same for `useStore(store, s => …)`.
        // A function's other children are params (patterns, never these expressions).
        selector: [
            // The returned value may itself be asserted (`(s.list ?? []) as Item[]`, NEW_VALUE).
            `${STORE_SELECTOR} > ${NEW_VALUE}`,
            ...RETURN_CONTAINERS.map(
                container =>
                    `${STORE_SELECTOR} > BlockStatement > ${container}ReturnStatement > ${NEW_VALUE}`,
            ),
            `${STORE_HOOK} > :matches(${LITERAL})`,
        ].join(', '),
        message:
            'A selector that returns a new object or array re-renders on every store change (an infinite loop in Zustand 5): wrap it, `useXStore(useShallow(state => ({ … })))`.',
    },
];

/**
 * Spec 02 §D5 "default export exceptions": tool configs that their tool loads by its default
 * export, and declaration files. Route modules need no exception (D6 `lazy` takes a named
 * `Component`; until D6, `import('pages/X').then(m => ({ default: m.X }))`).
 */
export const DEFAULT_EXPORT_EXCEPTIONS = [
    '*.config.{js,ts,mjs}',
    'eslint.config.js',
    'vite.config.ts',
    'vitest*.config.ts',
    'pwa-assets.config.ts',
    '**/*.d.ts',
];

const STORAGE_MESSAGE = 'Use the typed helpers in helpers/localStorage.ts.';
const STORAGE_NAMES = ['localStorage', 'sessionStorage'];
const NAVIGATOR_ONLINE = {
    object: 'navigator',
    property: 'onLine',
    message: 'Use isNetworkUsable() (shared/offline/network).',
};
const GLOBAL_STORAGE = ['window', 'globalThis', 'self'].flatMap(object =>
    STORAGE_NAMES.map(property => ({ object, property, message: STORAGE_MESSAGE })),
);

/**
 * Storage boundary: localStorage and sessionStorage (also as `window.*`/`globalThis.*`/`self.*`) only
 * through helpers/localStorage.ts; tests and test support arrange storage directly.
 * `navigator.onLine` below; named exports only (D11, 02-C13: the existing default exports are
 * suppressions that only shrink, D31; a touched file switches to `export { X }` with its importers
 * and `vi.mock` in the same PR).
 */
export const projectConfig = ({ appDir }) => {
    const storageExempt = [
        appGlob(appDir, 'src/helpers/localStorage.ts'),
        appGlob(appDir, 'src/test/**'),
        ...TEST_FILES,
    ];
    const offline = appGlob(appDir, 'src/shared/offline/**');

    return [
        {
            name: 'chipin/no-default-export',
            files: [LINT_FILES],
            ignores: [
                ...DEFAULT_EXPORT_EXCEPTIONS.map(glob => appGlob(appDir, glob)),
                '*.config.{js,ts,mjs}',
            ],
            plugins: { 'import-x': importX },
            rules: {
                'import-x/no-default-export': 'error',
            },
        },
        {
            files: [LINT_FILES, ASTRO_FILES],
            ignores: storageExempt,
            rules: {
                'no-restricted-globals': [
                    'error',
                    ...STORAGE_NAMES.map(name => ({ name, message: STORAGE_MESSAGE })),
                ],
            },
        },
        // `no-restricted-properties` holds both checks: a later block replaces the options of an
        // earlier one, so each block lists everything its files must keep.
        // spec 03 §1.7: TanStack `onlineManager` is the single source of "network is usable";
        // `navigator.onLine` is read only by its bootstrap and probe in shared/offline.
        {
            files: [LINT_FILES, ASTRO_FILES],
            rules: {
                'no-restricted-properties': ['error', NAVIGATOR_ONLINE, ...GLOBAL_STORAGE],
            },
        },
        {
            files: [offline],
            rules: {
                'no-restricted-properties': ['error', ...GLOBAL_STORAGE],
            },
        },
        {
            files: storageExempt,
            ignores: [offline],
            rules: {
                'no-restricted-properties': ['error', NAVIGATOR_ONLINE],
            },
        },
        {
            files: [appGlob(appDir, 'src/shared/offline/**/*.{test,spec}.{ts,tsx}')],
            rules: {
                'no-restricted-properties': 'off',
            },
        },
    ];
};

// There is no `warn` level (spec 02 §D0): the preset's warnings become errors, with or without
// options (`'warn'`, `1`, `['warn', ...options]`); an unknown value shape fails the config load.
const asError = (name, value) => {
    const [severity, ...options] = Array.isArray(value) ? value : [value];

    if (!['off', 'warn', 'error', 0, 1, 2].includes(severity)) {
        throw new Error(
            `@tanstack/query preset: unexpected severity for ${name}: ${JSON.stringify(value)}`,
        );
    }
    const level = severity === 'warn' || severity === 1 ? 'error' : severity;

    return options.length > 0 ? [level, ...options] : level;
};
const queryRecommendedRules = Object.fromEntries(
    pluginQuery.configs['flat/recommended'].flatMap(block =>
        Object.entries(block.rules ?? {}).map(([name, value]) => [name, asError(name, value)]),
    ),
);

/** TanStack Query: `plugin:@tanstack/query/recommended` (spec 03 §1.3). */
export const queryConfig = () => [
    {
        files: [LINT_FILES],
        plugins: { '@tanstack/query': pluginQuery },
        rules: queryRecommendedRules,
    },
];
