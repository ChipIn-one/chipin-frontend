// Review R1 B1 (05-3): only the SPA (`main`, through `initAppearance()`) controls the `<html>` theme
// class; importing the store or the public pages, which control it themselves, leaves it as it is.
import { expect, test, vi } from 'vitest';

import { LS_KEY_THEME } from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';

// The public pages import the logo through svgr, which the test config does not run.
vi.mock('@chipin/tokens/assets/logo.svg?react', () => ({ default: () => null }));

test('importing the store or the public pages leaves <html> as it is', async () => {
    document.documentElement.className = '';
    LocalStorage.setRaw(LS_KEY_THEME, 'dark');

    const { useAppearanceStore } = await import('store/ui-prefs');
    await import('public-routes');

    expect(useAppearanceStore.getState().resolved).toBe('dark');
    expect(document.documentElement.className).toBe('');
    expect(document.documentElement.style.colorScheme).toBe('');

    const { initAppearance } = await import('store/ui-prefs');
    initAppearance();
    expect(document.documentElement.className).toBe('dark');
});
