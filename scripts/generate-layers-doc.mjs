// Writes the layer table of docs/engineering/rules/10-architecture.md from config/eslint/layers.js,
// the only source of the layer graph (spec 02 §D5, A-12). The table sits between the BEGIN/END
// markers; the rest of the file is hand-written.
//
// Usage: node scripts/generate-layers-doc.mjs           (rewrites the table)
//        node scripts/generate-layers-doc.mjs --check   (exit 1 when the committed table is stale)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import * as prettier from 'prettier';

import {
    INDEX_ONLY,
    LAYER_ELEMENTS,
    LAYER_GRAPH,
    LAYER_TYPES,
    LAYERS_DOC,
} from '../config/eslint/layers.js';

const repoRoot = resolve(import.meta.dirname, '..');

export const BEGIN =
    '<!-- BEGIN layers (generated from config/eslint/layers.js by `npm run layers:doc`; do not edit) -->';
export const END = '<!-- END layers -->';

const code = value => `\`${value}\``;

const folders = patterns =>
    patterns
        .map(({ pattern, mode }) => {
            if (mode === 'folder') {
                return code(`${pattern}/`);
            }
            return pattern.includes('*') ? `${code(pattern)} files` : code(pattern);
        })
        .join(', ');

const allowed = from => {
    if (from === 'app') {
        return 'everything';
    }
    return LAYER_GRAPH[from]
        .map(type =>
            type === from && INDEX_ONLY.includes(from)
                ? `${code(type)} (another slice only via its \`index.ts\`)`
                : code(type),
        )
        .join(', ');
};

/** The generated block, markers included (before Prettier). */
export const renderTable = () =>
    [
        BEGIN,
        '',
        'Element types (folders under `src/`; the first matching row wins) and what each may import.',
        'Anything not listed is a `boundaries/dependencies` error.',
        '',
        '| Layer | Folders | May import |',
        '| --- | --- | --- |',
        ...LAYER_ELEMENTS.map(
            ({ type, patterns }) => `| ${code(type)} | ${folders(patterns)} | ${allowed(type)} |`,
        ),
        '',
        END,
    ].join('\n');

/** Replaces the block between the markers in `text` and formats the file with Prettier. */
export const renderDoc = async (text, filepath = resolve(repoRoot, LAYERS_DOC)) => {
    const start = text.indexOf(BEGIN);
    const end = text.indexOf(END);

    if (start < 0 || end < start) {
        throw new Error(`${LAYERS_DOC}: the BEGIN/END layers markers are missing`);
    }
    const next = text.slice(0, start) + renderTable() + text.slice(end + END.length);
    const options = await prettier.resolveConfig(filepath);

    return prettier.format(next, { ...options, filepath });
};

export const main = async (argv = process.argv.slice(2)) => {
    if (LAYER_TYPES.some(type => !LAYER_GRAPH[type])) {
        throw new Error('config/eslint/layers.js: every element type needs a LAYER_GRAPH entry');
    }
    const path = resolve(repoRoot, LAYERS_DOC);
    const current = readFileSync(path, 'utf8');
    const generated = await renderDoc(current, path);

    if (argv.includes('--check')) {
        if (generated !== current) {
            console.error(`${LAYERS_DOC} is stale: run \`npm run layers:doc\`.`);
            return 1;
        }
        console.log(`${LAYERS_DOC} matches config/eslint/layers.js.`);
        return 0;
    }
    writeFileSync(path, generated);
    console.log(`Wrote the layer table of ${LAYERS_DOC}.`);
    return 0;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exit(await main());
}
