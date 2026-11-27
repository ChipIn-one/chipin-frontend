// 04-4a1 (spec 04 §2.11 option (a)): the build renames dist/sw.js to dist/sw-app.js.
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { renameAppServiceWorker, swAppPlugin } from './sw-app-plugin';

let outDir = '';

beforeEach(async () => {
    outDir = await mkdtemp(path.join(tmpdir(), 'chipin-sw-app-'));
});

afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
});

test('renames sw.js to sw-app.js and leaves no file at sw.js', async () => {
    await writeFile(path.join(outDir, 'sw.js'), 'precacheAndRoute([]);');

    await renameAppServiceWorker(outDir);

    expect((await readdir(outDir)).sort()).toEqual(['sw-app.js']);
    expect(await readFile(path.join(outDir, 'sw-app.js'), 'utf8')).toBe('precacheAndRoute([]);');
});

test('fails when VitePWA wrote no sw.js', async () => {
    await expect(renameAppServiceWorker(outDir)).rejects.toThrow(/sw\.js/);
});

test('moves an emitted source map with the worker and keeps sourceMappingURL consistent', async () => {
    await writeFile(path.join(outDir, 'sw.js'), 'x();\n//# sourceMappingURL=sw.js.map');
    await writeFile(path.join(outDir, 'sw.js.map'), '{}');

    await renameAppServiceWorker(outDir);

    expect((await readdir(outDir)).sort()).toEqual(['sw-app.js', 'sw-app.js.map']);
    expect(await readFile(path.join(outDir, 'sw-app.js'), 'utf8')).toBe(
        'x();\n//# sourceMappingURL=sw-app.js.map',
    );
});

test('runs last in closeBundle, after the VitePWA worker is written', () => {
    const plugin = swAppPlugin();

    expect(plugin.enforce).toBe('post');
    expect(plugin.closeBundle).toMatchObject({ sequential: true, order: 'post' });
    expect(plugin.configurePreviewServer).toBeTypeOf('function');
});

const runCloseBundle = (error?: Error): Promise<void> => {
    const hook = swAppPlugin().closeBundle;

    if (typeof hook !== 'object' || hook === null) {
        throw new Error('closeBundle must be an object hook');
    }

    // The handler never reads the plugin context, so an empty one stands in for Rollup's.
    const context = {} as ThisParameterType<typeof hook.handler>;

    return Promise.resolve(hook.handler.call(context, error));
};

test('returns without the rename check when the build already failed', async () => {
    // No configResolved and no dist: without the build error the hook would throw on sw.js.
    await expect(runCloseBundle(new Error('rolldown failed'))).resolves.toBeUndefined();
    await expect(runCloseBundle()).rejects.toThrow(/sw\.js/);
});
