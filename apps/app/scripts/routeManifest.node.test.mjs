// Spec 04 §2.2: a Node 24 script must be able to import the route manifest without a build (type
// stripping only: no runtime imports, no enums or other non-erasable syntax). A plain `node`
// process imports the real file, so any break of that property fails here. This lives in
// scripts/ (a node-only .mjs test) because the app tsconfig has no Node types.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'vitest';

import { APP_ROUTES } from '../src/app/router/routeManifest.ts';

const MANIFEST_URL = pathToFileURL(
    resolve(import.meta.dirname, '../src/app/router/routeManifest.ts'),
).href;

test('node imports the route manifest without a build', () => {
    const script = `const { APP_ROUTES } = await import(${JSON.stringify(MANIFEST_URL)});
process.stdout.write(JSON.stringify(APP_ROUTES.map(route => route.id)));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
        encoding: 'utf8',
    });

    expect(result.stderr).not.toMatch(/Error/);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(APP_ROUTES.map(route => route.id));
}, 20_000);
