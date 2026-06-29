import type { ThemeName } from 'api/chipin.types';

import { getLocalUser } from './localStorage';

const resolveStoredTheme = (): ThemeName => {
    const localTheme = getLocalUser()?.settings.theme;

    if (!localTheme) {
        return 'system';
    }

    return localTheme;
};

export { resolveStoredTheme };
export type { ThemeName };
