// @vitest-environment node
// Review R1 B1 (05-3): the public SSR/SSG (`prerender-public.mjs`, plain Node) imports the store
// through shared components; importing it must not touch a DOM that does not exist.
import { expect, test, vi } from 'vitest';

vi.mock('@chipin/tokens/assets/logo.svg?react', () => ({ default: () => null }));

test('the store imports and resolves without a DOM', async () => {
    expect(typeof document).toBe('undefined');

    const { useAppearanceStore } = await import('store/ui-prefs');

    expect(useAppearanceStore.getState().resolved).toBe('light');
});

test('the public server entry imports without a DOM', async () => {
    // As prerender-public.mjs sets it.
    vi.stubEnv('VITE_CHIPIN_ENV', 'dev');

    await expect(import('public-routes/entry-server')).resolves.toBeDefined();
});
