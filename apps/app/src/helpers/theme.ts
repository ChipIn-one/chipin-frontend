import type { ThemeName } from 'api/chipin.types';

import { getLocalUser } from './localStorage';

const resolveStoredTheme = (): ThemeName => {
    const localTheme = getLocalUser()?.settings.theme;

    if (!localTheme) {
        return 'system';
    }

    return localTheme;
};

const isThemeDark = (themeName?: string | null) => themeName === 'dark';

// On public pages the last account's saved theme overrides the device setting.
// Missing or unrecognized values follow the OS, without restoring authentication.
const isPreferredPublicThemeDark = (systemIsDark: boolean): boolean => {
    const savedTheme = resolveStoredTheme();
    if (savedTheme === 'light') {
        return false;
    }
    if (savedTheme === 'dark') {
        return true;
    }
    return systemIsDark;
};

export { isPreferredPublicThemeDark, isThemeDark, resolveStoredTheme };
export type { ThemeName };
