import type { SelfUser, ThemeName, UserRole, UserSettings } from 'api/chipin.types';
import { DEFAULT_EXPENSE_CATEGORY } from 'constants/category';
import { DEFAULT_CURRENCY_CODE } from 'constants/currencies';
import {
    LS_KEY_AUTH_SESSION_HINT,
    type LS_KEY_LOCALE,
    type LS_KEY_SW_UPDATE_DISMISSED_AT,
    type LS_KEY_THEME,
    LS_KEY_USER,
} from 'constants/localstorage';

export interface LocalUser {
    /** The signed-in user: picks the per-user query cache before `users/self` loads (spec 03 §1.5). */
    id?: string;
    role?: UserRole;
    settings: UserSettings;
}

// The stored user is validated on read (invariant 6) by a hand-written reader, not zod: this
// module is on the landing path (theme, language), and zod would add ~15 KB gz (zod/mini) to
// ~23 KB gz (zod) to what the landing loads. Lenient per field: a user stored by an older build
// that lacks a field, or has an unknown value, keeps every valid field, so the landing
// language/theme survive (fallbacks below). An invalid `id`/`role` is dropped; only a structurally
// broken record (not an object, no `settings` object) reads as absent.
type UnknownRecord = Partial<Record<string, unknown>>;

const isRecord = (value: unknown): value is UnknownRecord =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const stringOr = (value: unknown, fallback: string): string =>
    typeof value === 'string' ? value : fallback;

const booleanOr = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.find(option => option === value) ?? fallback;

const TIME_FORMATS = ['12h', '24h'] as const;
const THEMES = ['light', 'dark', 'system'] as const;
const SEXES = ['male', 'female'] as const;
const ROLES = ['USER', 'ADMIN'] as const;

// The fallbacks are the ones the app already applies to a missing setting: the default currency
// and category constants and the `users-store` selectors (`selectUserSettings(s)?.x ?? …`, where a
// missing `timeFormat` reads as 12h). One exception: language `''` (unset; locale detection
// decides) instead of the selector's `'en'`, so the landing locale is not forced.
const parseUserSettings = (value: UnknownRecord): UserSettings => ({
    defaultCurrency: stringOr(value.defaultCurrency, DEFAULT_CURRENCY_CODE),
    defaultCategory: stringOr(value.defaultCategory, DEFAULT_EXPENSE_CATEGORY),
    timeFormat: oneOf(value.timeFormat, TIME_FORMATS, '12h'),
    language: stringOr(value.language, ''),
    theme: oneOf(value.theme, THEMES, 'system'),
    simplifyDebts: booleanOr(value.simplifyDebts, true),
    skipCategory: booleanOr(value.skipCategory, false),
    soloModeByDefault: booleanOr(value.soloModeByDefault, false),
    saveGroupExpensesToSolo: booleanOr(value.saveGroupExpensesToSolo, false),
    sex: oneOf(value.sex, SEXES, 'male'),
});

const parseLocalUser = (value: unknown): LocalUser | null => {
    if (!isRecord(value) || !isRecord(value.settings)) {
        return null;
    }
    const id = typeof value.id === 'string' && value.id !== '' ? value.id : undefined;
    const role = ROLES.find(option => option === value.role);

    return {
        ...(id === undefined ? {} : { id }),
        ...(role === undefined ? {} : { role }),
        settings: parseUserSettings(value.settings),
    };
};

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
        LocalStorage.remove(key);
        return null;
    }
};

const toLocalUser = (user: Pick<SelfUser, 'id' | 'role' | 'settings'>): LocalUser => {
    return {
        id: user.id,
        role: user.role,
        settings: user.settings,
    };
};

const getLocalUser = (): LocalUser | null => {
    return parseLocalUser(getStorageValue<unknown>(LS_KEY_USER));
};

const saveLocalUser = (user: LocalUser) => {
    LocalStorage.set(LS_KEY_USER, user);
};

// Drop only the cached role; settings (language/theme) must survive. The `id` stays (spec 03
// §1.5: session expiry keeps the user's cache).
const clearLocalUserRole = () => {
    const localUser = getLocalUser();

    if (localUser) {
        saveLocalUser(
            localUser.id === undefined
                ? { settings: localUser.settings }
                : { id: localUser.id, settings: localUser.settings },
        );
    }
};

// Sign-out (spec 03 §1.5, invariant 12): only `{ settings }` remains, the landing language/theme.
const clearLocalUserIdentity = () => {
    const localUser = getLocalUser();

    if (localUser) {
        saveLocalUser({ settings: localUser.settings });
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
    clearLocalUserIdentity,
    clearLocalUserRole,
    getLocalUser,
    hasAuthSessionHint,
    LocalStorage,
    saveLocalUser,
    setAuthSessionHint,
    toLocalUser,
};
export type { StorageKey, StorageSchema };
