import type { ThemeName } from 'api/chipin.types';

import { getLocalUser } from './localStorage';

// On public pages the last account's saved theme overrides the device setting.
// Missing or unrecognized values follow the OS, without restoring authentication.
const isPreferredPublicThemeDark = (systemIsDark: boolean): boolean => {
    const savedTheme = getLocalUser()?.settings.theme;
    if (savedTheme === 'light') {
        return false;
    }
    if (savedTheme === 'dark') {
        return true;
    }
    return systemIsDark;
};

export { isPreferredPublicThemeDark };
export type { ThemeName };
