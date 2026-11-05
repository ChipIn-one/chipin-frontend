import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { LAYER_GRAPH, LAYER_TYPES, LAYERS_DOC } from '../config/eslint/layers.js';
import { BEGIN, END, renderDoc, renderTable } from './generate-layers-doc.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const docPath = resolve(repoRoot, LAYERS_DOC);

describe('generate-layers-doc', () => {
    test('the committed 10-architecture.md table matches config/eslint/layers.js', async () => {
        const committed = readFileSync(docPath, 'utf8');

        expect(await renderDoc(committed, docPath)).toBe(committed);
    });

    test('renders one row per element type with its allowed imports', () => {
        const table = renderTable();

        for (const type of LAYER_TYPES) {
            expect(table).toContain(`| \`${type}\` |`);
        }
        expect(table).toContain('`features` (another slice only via its `index.ts`)');
        expect(table.startsWith(BEGIN) && table.endsWith(END)).toBe(true);
    });

    test('fails without the markers', async () => {
        await expect(renderDoc('# Architecture\n', docPath)).rejects.toThrow(/markers are missing/);
    });
});

describe('layer graph (spec 02 §D5, A-12)', () => {
    test('every target is a known element type', () => {
        for (const [from, targets] of Object.entries(LAYER_GRAPH)) {
            expect(LAYER_TYPES).toContain(from);
            for (const to of targets) {
                expect(LAYER_TYPES).toContain(to);
            }
        }
    });

    test('is acyclic apart from imports inside a layer (app may import everything)', () => {
        const edges = Object.entries(LAYER_GRAPH)
            .filter(([from]) => from !== 'app')
            .map(([from, targets]) => [from, targets.filter(to => to !== from && to !== 'app')]);
        const graph = Object.fromEntries(edges);
        const visiting = new Set();
        const done = new Set();
        const visit = node => {
            if (done.has(node)) {
                return;
            }
            if (visiting.has(node)) {
                throw new Error(`cycle through ${node}`);
            }
            visiting.add(node);
            for (const next of graph[node] ?? []) {
                visit(next);
            }
            visiting.delete(node);
            done.add(node);
        };

        expect(() => Object.keys(graph).forEach(visit)).not.toThrow();
        expect(LAYER_GRAPH.entities).not.toContain('store');
        expect(LAYER_GRAPH.helpers).not.toContain('api');
    });

    test('UI layers and helpers do not see shared-api (inv. 2)', () => {
        for (const from of ['pages', 'features', 'components', 'basics', 'helpers']) {
            expect(LAYER_GRAPH[from]).not.toContain('shared-api');
        }
    });
});
