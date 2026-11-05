import { appGlob, LINT_FILES } from './base.js';

// In flat config a later block replaces the options of `no-restricted-syntax` /
// `no-restricted-imports` for the files it matches, so separate blocks silently drop each
// other's entries. All entries of one rule are therefore passed to ONE helper call
// (`restrictedSyntax()` / `restrictedImports()`, wired once in eslint.config.js); modules only
// contribute entry lists.
//
// Entry: { id, message, files?, ignores?, pending?, ...rule fields }. `files`/`ignores` are globs
// (each glob is one "scope"); an entry applies to a file that matches one of its `files` (or to
// every file when `files` is absent) and none of its `ignores`. Every message is prefixed with
// `[id]`; the id is the registry key `<rule>#<id>` in config/eslint/rule-classes.json.
// `pending: true` marks an entry whose globs match no file yet (e.g. `src/money/**` before the
// money module exists): scripts/check-rule-registry.mjs then does not report its key as dead.
// Their `<rule>#<id>` keys are kept on each block under the PENDING_IDS symbol, which ESLint ignores.
export const PENDING_IDS = Symbol.for('chipin.eslint.pendingIds');

const MAX_SCOPES = 6;
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

    return scopeCombinations(scopes).map(combo => {
        const active = entries.filter(entry => appliesTo(entry, new Set(combo)));

        return {
            name: `chipin/${ruleName}/${combo.join(' & ') || 'all'}`,
            files: [[LINT_FILES, ...combo]],
            rules: { [ruleName]: active.length > 0 ? ['error', ...toOptions(active)] : 'off' },
            [PENDING_IDS]: active
                .filter(entry => entry.pending)
                .map(entry => `${ruleName}#${entry.id}`),
        };
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

/** ChipIn `no-restricted-imports` entries that are not layer boundaries. */
export const projectImports = ({ appDir = '.' } = {}) => [
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
            regex: '^(?:shared/money|(?:\\.\\.?/)+(?:[^/]+/)*money)$',
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
// A new object/array on every call: a literal, or a conditional with a literal branch.
const LITERAL = 'ObjectExpression, ArrayExpression';
const LITERAL_TYPE = '/^(?:ObjectExpression|ArrayExpression)$/';
const NEW_VALUE = `:matches(${LITERAL}, ConditionalExpression[consequent.type=${LITERAL_TYPE}], ConditionalExpression[alternate.type=${LITERAL_TYPE}])`;

/**
 * ChipIn project `no-restricted-syntax` entries (spec 02 §D0 "project"; 02-C12): images only
 * through basics/Image, Zustand reads only by a selector, an object selector only with useShallow
 * (D12). The store entries are a heuristic: derived values (`.map`/`.filter`, `Object.assign`)
 * and named selectors are not detected.
 */
export const projectRules = ({ appDir }) => [
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
        message: 'Use the Image component from basics/Image instead of `<img>`/`styled.img`.',
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
        // `useXStore(s => { return { … }; })`, `useXStore({ … })`; the same for `useStore(store, s => …)`.
        // A function's other children are params (patterns, never these expressions).
        selector: [
            `${STORE_SELECTOR} > ${NEW_VALUE}`,
            `${STORE_SELECTOR} > BlockStatement > ReturnStatement > ${NEW_VALUE}`,
            `${STORE_HOOK} > :matches(${LITERAL})`,
        ].join(', '),
        message:
            'A selector that returns a new object or array re-renders on every store change (an infinite loop in Zustand 5): wrap it, `useXStore(useShallow(state => ({ … })))`.',
    },
];

/** Storage boundary: localStorage only through helpers/localStorage.ts. */
export const projectConfig = ({ appDir }) => [
    {
        files: [LINT_FILES],
        rules: {
            'no-restricted-globals': [
                'error',
                {
                    name: 'localStorage',
                    message: 'Use the typed helper in helpers/localStorage.ts.',
                },
            ],
        },
    },
    {
        files: [appGlob(appDir, 'src/helpers/localStorage.ts')],
        rules: {
            'no-restricted-globals': 'off',
        },
    },
];
