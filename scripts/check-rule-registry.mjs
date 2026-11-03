// Checks that every enabled ESLint rule is in the rule registry (spec 02 §D0):
// config/eslint/rule-classes.json maps `<rule>` or `<rule>#<id>` to class `a` (auto-fixable) or
// `b` (correctness or boundary). Class c rules are not allowed in the config, and there is no
// `warn` level. Entries of `no-restricted-syntax`/`no-restricted-imports` are registered by the
// `[id]` prefix of their message.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ESLint } from 'eslint';

const repoRoot = resolve(import.meta.dirname, '..');

export const REGISTRY_PATH = 'config/eslint/rule-classes.json';
// A component, a store, a test and a ds-gallery file (spec 02 §D0: component, store, test).
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
 * @param {{ registry: Record<string, string>, resolved: Array<{ file: string, rules: object }>, blocks: object[] }} input
 *   `resolved`: effective rules per sample file; `blocks`: raw config blocks (all scopes).
 * @returns {string[]} errors
 */
export const checkRegistry = ({ registry, resolved, blocks }) => {
    const errors = new Set();
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

    const checkIds = (ruleName, value, where) => {
        for (const message of entryMessages(ruleName, value)) {
            const id = message?.match(ID_PREFIX)?.[1];

            if (!id) {
                errors.add(`${ruleName} entry without an [id] message prefix (${where})`);
            } else {
                requireEntry(`${ruleName}#${id}`, where);
            }
        }
    };

    for (const { file, rules } of resolved) {
        for (const [ruleName, value] of Object.entries(rules ?? {})) {
            if (!isEnabled(value)) {
                continue;
            }
            if (isWarn(value)) {
                errors.add(`${ruleName} is "warn" in ${file}: use error or off`);
            }
            if (ID_RULES.has(ruleName)) {
                checkIds(ruleName, value, file);
            } else {
                requireEntry(ruleName, file);
            }
        }
    }

    // Restricted-syntax/imports entries may be scoped to files the samples do not cover.
    for (const block of blocks) {
        for (const [ruleName, value] of Object.entries(block.rules ?? {})) {
            if (ID_RULES.has(ruleName) && isEnabled(value)) {
                checkIds(ruleName, value, `block ${block.name ?? '(unnamed)'}`);
            }
        }
    }

    return [...errors];
};

export const main = async () => {
    const registry = JSON.parse(readFileSync(resolve(repoRoot, REGISTRY_PATH), 'utf8'));
    const eslint = new ESLint({ cwd: repoRoot });
    const resolved = await Promise.all(
        SAMPLE_FILES.map(async file => ({
            file,
            rules: (await eslint.calculateConfigForFile(resolve(repoRoot, file)))?.rules,
        })),
    );
    const { default: blocks } = await import(pathToFileURL(resolve(repoRoot, 'eslint.config.js')));

    return checkRegistry({ registry, resolved, blocks });
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    const errors = await main();

    if (errors.length > 0) {
        console.error(`Rule registry check failed (spec 02 §D0):\n- ${errors.join('\n- ')}`);
        process.exit(1);
    }
    console.log('Rule registry: every enabled ESLint rule is class a or b.');
}
