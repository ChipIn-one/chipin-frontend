import { appGlob, LINT_FILES } from './base.js';

// In flat config a later block replaces the options of `no-restricted-syntax` /
// `no-restricted-imports` for the files it matches, so separate blocks silently drop each
// other's entries. All entries of one rule are therefore passed to ONE helper call
// (`restrictedSyntax()` / `restrictedImports()`, wired once in eslint.config.js); modules only
// contribute entry lists.
//
// Entry: { id, message, files?, ignores?, ...rule fields }. `files`/`ignores` are globs (each
// glob is one "scope"); an entry applies to a file that matches one of its `files` (or to every
// file when `files` is absent) and none of its `ignores`. Every message is prefixed with `[id]`;
// the id is the registry key `<rule>#<id>` in config/eslint/rule-classes.json.

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
export const projectImports = () => [
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
];

/** ChipIn `no-restricted-syntax` entries (money: spec 03-1, colors/styles: spec 05-5). */
export const projectSyntax = () => [];

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
