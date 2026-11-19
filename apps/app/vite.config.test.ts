// Spec 04 §2.11 (04-2d): the app is served from the host root; the SW registration path, its scope
// and the manifest link are built on `base`.
import type { UserConfig } from 'vite';
import { expect, test } from 'vitest';

import viteConfig from './vite.config.ts';

const resolveConfig = (): UserConfig => {
    if (typeof viteConfig !== 'function') {
        throw new TypeError('vite.config.ts must export a config function');
    }
    const config = viteConfig({ command: 'build', mode: 'test', isSsrBuild: false });

    if (config instanceof Promise) {
        throw new TypeError('vite.config.ts must resolve synchronously');
    }
    return config;
};

test('base is /', () => {
    expect(resolveConfig().base).toBe('/');
});
