import type { SelfUser, ThemeName, UserRole, UserSettings } from 'api/chipin.types';
import {
    LS_KEY_AUTH_SESSION_HINT,
    LS_KEY_AUTH_TOKENS,
    LS_KEY_LOCALE,
    LS_KEY_SW_UPDATE_DISMISSED_AT,
    LS_KEY_THEME,
    LS_KEY_USER,
} from 'constants/localstorage';

export interface LocalUser {
    role: UserRole;
    settings: UserSettings;
}

type StorageSchema = {
    [LS_KEY_AUTH_SESSION_HINT]: boolean;
    [LS_KEY_USER]: LocalUser;
    [LS_KEY_LOCALE]: string;
    [LS_KEY_THEME]: ThemeName;
    [LS_KEY_SW_UPDATE_DISMISSED_AT]: number;
};

type StorageKey = keyof StorageSchema;

const LocalStorage = {
    get<K extends StorageKey>(key: K, fallback: StorageSchema[K]): StorageSchema[K] {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) {
                return fallback;
            }
            return JSON.parse(raw) as StorageSchema[K];
        } catch {
            return fallback;
        }
    },

    set<K extends StorageKey>(key: K, value: StorageSchema[K]): void {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // ignore write errors (storage full, private mode, etc.)
        }
    },

    remove(key: StorageKey): void {
        try {
            localStorage.removeItem(key);
        } catch {
            // ignore
        }
    },

    clear(): void {
        try {
            localStorage.clear();
        } catch {
            // ignore
        }
    },

    getRaw(key: StorageKey): string | null {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },
};

const getStorageValue = <T>(key: StorageKey): T | null => {
    try {
        const raw = localStorage.getItem(key);

        if (!raw) {
            return null;
        }

        return JSON.parse(raw) as T;
    } catch {
        localStorage.removeItem(key);
        return null;
    }
};

const toLocalUser = (user: Pick<SelfUser, 'role' | 'settings'>): LocalUser => {
    return {
        role: user.role,
        settings: user.settings,
    };
};

const getLocalUser = () => {
    return getStorageValue<LocalUser>(LS_KEY_USER);
};

const saveLocalUser = (user: LocalUser) => {
    LocalStorage.set(LS_KEY_USER, user);
};

const clearLegacyAuthTokens = (): void => {
    try {
        localStorage.removeItem(LS_KEY_AUTH_TOKENS);
    } catch {
        // Legacy auth state must never block the cookie-backed session flow.
    }
};

const hasAuthSessionHint = (): boolean => {
    return LocalStorage.get(LS_KEY_AUTH_SESSION_HINT, false);
};

const setAuthSessionHint = (hasSession: boolean): boolean => {
    if (hasSession) {
        try {
            localStorage.setItem(LS_KEY_AUTH_SESSION_HINT, JSON.stringify(true));
            return localStorage.getItem(LS_KEY_AUTH_SESSION_HINT) === 'true';
        } catch {
            return false;
        }
    }

    try {
        localStorage.removeItem(LS_KEY_AUTH_SESSION_HINT);
    } catch {
        try {
            localStorage.setItem(LS_KEY_AUTH_SESSION_HINT, JSON.stringify(false));
        } catch {
            return false;
        }
    }

    try {
        return localStorage.getItem(LS_KEY_AUTH_SESSION_HINT) !== 'true';
    } catch {
        return false;
    }
};

export {
    clearLegacyAuthTokens,
    getLocalUser,
    hasAuthSessionHint,
    LocalStorage,
    saveLocalUser,
    setAuthSessionHint,
    toLocalUser,
};
export type { StorageKey, StorageSchema };
