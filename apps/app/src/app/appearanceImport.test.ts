// Review R1 B1 (05-3): only the SPA (`main`, through `initAppearance()`) controls the `<html>` theme
// class; importing the store leaves it as it is.
import { expect, test } from 'vitest';

import { LS_KEY_THEME } from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';

test('importing the store leaves <html> as it is', async () => {
    document.documentElement.className = '';
    LocalStorage.setRaw(LS_KEY_THEME, 'dark');

    const { useAppearanceStore } = await import('store/ui-prefs');

    expect(useAppearanceStore.getState().resolved).toBe('dark');
    expect(document.documentElement.className).toBe('');
    expect(document.documentElement.style.colorScheme).toBe('');

    const { initAppearance } = await import('store/ui-prefs');
    initAppearance();
    expect(document.documentElement.className).toBe('dark');
});
