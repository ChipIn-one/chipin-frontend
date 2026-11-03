// Checks that every enabled ESLint rule is in the rule registry (spec 02 §D0):
// config/eslint/rule-classes.json maps `<rule>` or `<rule>#<id>` to class `a` (auto-fixable) or
// `b` (correctness or boundary). Class c rules are not allowed in the config, and there is no
// `warn` level. Entries of `no-restricted-syntax`/`no-restricted-imports` are registered by the
// `[id]` prefix of their message.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ESLint } from 'eslint';

const repoRoot = resolve(import.meta.dirname, '..');

export const REGISTRY_PATH = 'config/eslint/rule-classes.json';
// Files that must be linted (spec 02 §D0: a component, a store, a test; plus ds-gallery). Rules
// are collected from every linted file; the samples guard against a broken file enumeration.
export const SAMPLE_FILES = [
    'src/components/AddExpenseButton.tsx',
    'src/store/authStore.ts',
    'src/store/authStore.test.ts',
    'ds-gallery/gallery.tsx',
];
const ID_RULES = new Set(['no-restricted-syntax', 'no-restricted-imports']);
const ID_PREFIX = /^\[([a-z0-9]+(?:-[a-z0-9]+)*)\] /;
const CLASSES = new Set(['a', 'b']);

const severityOf = value => (Array.isArray(value) ? value[0] : value);
const isEnabled = value => ![0, 'off'].includes(severityOf(value));
const isWarn = value => [1, 'warn'].includes(severityOf(value));

/** Messages of every entry in the options of a restricted-syntax/imports rule. */
export const entryMessages = (ruleName, value) => {
    const options = Array.isArray(value) ? value.slice(1) : [];

    if (ruleName === 'no-restricted-syntax') {
        return options.map(option => (typeof option === 'string' ? undefined : option.message));
    }

    return options.flatMap(option => {
        if (typeof option === 'string') {
            return [undefined];
        }
        if (!option.paths && !option.patterns) {
            return [option.message];
        }

        return [...(option.paths ?? []), ...(option.patterns ?? [])].map(entry =>
            typeof entry === 'string' ? undefined : entry.message,
        );
    });
};

/**
 * @param {{ registry: Record<string, string>, resolved: Array<{ file: string, rules?: object }>, blocks: unknown[], samples?: string[] }} input
 *   `resolved`: effective rules of every linted file (undefined when a file has no config);
 *   `blocks`: raw config blocks, scanned only for restricted-entry ids (entries may be scoped to
 *   files that do not exist yet); `samples`: files that must get a config.
 * @returns {string[]} errors
 */
export const checkRegistry = ({ registry, resolved, blocks, samples = [] }) => {
    const errors = new Set();
    // Keys that are effective on at least one linted file.
    const effective = new Set();
    const requireEntry = (key, where) => {
        if (!(key in registry)) {
            errors.add(`${key} (${where}) has no entry in ${REGISTRY_PATH}`);
        }
    };

    for (const [key, value] of Object.entries(registry)) {
        if (!CLASSES.has(value)) {
            errors.add(`${key}: class "${value}" is not allowed (only a or b; class c is deleted)`);
        }
    }

    const entryIds = (ruleName, value, where) =>
        entryMessages(ruleName, value).flatMap(message => {
            const id = message?.match(ID_PREFIX)?.[1];

            if (!id) {
                errors.add(`${ruleName} entry without an [id] message prefix (${where})`);
                return [];
            }
            return [`${ruleName}#${id}`];
        });

    const byFile = new Map(resolved.map(({ file, rules }) => [file, rules]));

    for (const file of samples) {
        if (!byFile.get(file)) {
            errors.add(`sample file ${file} is missing, ignored or gets no ESLint config`);
        }
    }

    for (const { file, rules } of resolved) {
        for (const [ruleName, value] of Object.entries(rules ?? {})) {
            if (!isEnabled(value)) {
                continue;
            }
            if (isWarn(value)) {
                errors.add(`${ruleName} is "warn" in ${file}: use error or off`);
            }
            const keys = ID_RULES.has(ruleName) ? entryIds(ruleName, value, file) : [ruleName];

            for (const key of keys) {
                effective.add(key);
                requireEntry(key, file);
            }
        }
    }

    // Restricted entries may be scoped to files that do not exist yet: register them anyway.
    for (const block of blocks.flat(Infinity)) {
        for (const [ruleName, value] of Object.entries(block?.rules ?? {})) {
            if (ID_RULES.has(ruleName) && isEnabled(value)) {
                const where = `block ${block.name ?? '(unnamed)'}`;

                entryIds(ruleName, value, where).forEach(key => requireEntry(key, where));
            }
        }
    }

    // No dead or junk keys: every key is effective on at least one linted file.
    for (const key of Object.keys(registry)) {
        if (!effective.has(key)) {
            errors.add(`${key} in ${REGISTRY_PATH} is not effective on any linted file`);
        }
    }

    return [...errors];
};

const SOURCE_FILE = /\.[cm]?[jt]sx?$/;

/** Effective rules of every file ESLint lints (tracked and untracked, not ignored). */
export const resolveLintedFiles = async eslint => {
    const files = execFileSync(
        'git',
        ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
        { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    )
        .split('\0')
        .filter(file => SOURCE_FILE.test(file) && existsSync(resolve(repoRoot, file)));
    const resolved = [];

    for (const file of files) {
        const path = resolve(repoRoot, file);

        if (!(await eslint.isPathIgnored(path))) {
            const rules = (await eslint.calculateConfigForFile(path))?.rules;

            if (rules) {
                resolved.push({ file, rules });
            }
        }
    }

    return resolved;
};

export const main = async () => {
    const registry = JSON.parse(readFileSync(resolve(repoRoot, REGISTRY_PATH), 'utf8'));
    const resolved = await resolveLintedFiles(new ESLint({ cwd: repoRoot }));
    const { default: blocks } = await import(pathToFileURL(resolve(repoRoot, 'eslint.config.js')));

    return checkRegistry({ registry, resolved, blocks, samples: SAMPLE_FILES });
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    const errors = await main();

    if (errors.length > 0) {
        console.error(`Rule registry check failed (spec 02 §D0):\n- ${errors.join('\n- ')}`);
        process.exit(1);
    }
    console.log('Rule registry: every enabled ESLint rule is class a or b.');
}
