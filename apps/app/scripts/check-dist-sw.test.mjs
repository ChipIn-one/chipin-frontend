import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, test } from 'vitest';

import { missingServiceWorker } from './check-dist-sw.mjs';

let dir = '';

afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
});

test('fails a dist without sw.js and passes one with it (04-5b)', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'chipin-dist-sw-'));

    expect(missingServiceWorker(dir)).toMatch(/sw\.js/);
    writeFileSync(path.join(dir, 'sw.js'), '');
    expect(missingServiceWorker(dir)).toBeNull();
});
