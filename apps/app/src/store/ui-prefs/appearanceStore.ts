// Appearance (spec 05 §2): the single theme mechanism of the app. The preference is UI state
// (D3), saved as the raw string `light` | `dark` | `system` under LS_KEY_THEME (the format the
// former theme library wrote, so a saved choice survives). `resolved` drives the `light`/`dark` class on
// `<html>`, `<Theme appearance>` (AppTheme) and the Toaster. THEME_INIT_SCRIPT of
// `@chipin/tokens/theme-init` reads the same key before the app starts (no light frame in dark).
import { create } from 'zustand';

import { LS_KEY_THEME } from 'constants/localstorage';
import { getLocalUser, LocalStorage } from 'helpers/localStorage';
import type { ThemeName } from 'helpers/theme';

export type AppearancePreference = ThemeName;
export type ResolvedAppearance = 'light' | 'dark';

export interface AppearanceStore {
    preference: AppearancePreference;
    resolved: ResolvedAppearance;
    setPreference: (preference: AppearancePreference) => void;
}

const PREFERENCES: readonly AppearancePreference[] = ['light', 'dark', 'system'];
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/** The system dark-scheme query; null without `matchMedia` (jsdom, very old browsers). */
const darkSchemeQuery = (): MediaQueryList | null =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(DARK_SCHEME_QUERY)
        : null;

const resolveAppearance = (preference: AppearancePreference): ResolvedAppearance => {
    if (preference !== 'system') {
        return preference;
    }
    return darkSchemeQuery()?.matches === true ? 'dark' : 'light';
};

/** Sets the `light`/`dark` class (removing the other) and `color-scheme` on `<html>`. */
export const applyAppearance = (resolved: ResolvedAppearance): void => {
    const root = document.documentElement;

    root.classList.remove(resolved === 'dark' ? 'light' : 'dark');
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
};

const readStoredPreference = (): AppearancePreference => {
    const saved = LocalStorage.getRaw(LS_KEY_THEME);

    if (saved === null) {
        // One-time migration (spec 05 §2): before the key existed for every user, the theme was
        // read from the cached user's settings (`resolveStoredTheme`). Remove this branch after 2
        // releases. Tracked by #825.
        const legacyTheme = getLocalUser()?.settings.theme;

        if (legacyTheme !== undefined) {
            LocalStorage.setRaw(LS_KEY_THEME, legacyTheme);
            return legacyTheme;
        }
        return 'system';
    }
    // An unknown value reads as `light`, as THEME_INIT_SCRIPT reads it: the store keeps the class
    // the script set before the app started.
    return PREFERENCES.find(preference => preference === saved) ?? 'light';
};

// The system scheme subscription, live only while the preference is `system`.
let stopFollowingSystem: (() => void) | null = null;

const followSystem = (): void => {
    const query = darkSchemeQuery();

    if (query === null || typeof query.addEventListener !== 'function') {
        return;
    }
    const onChange = () => {
        const resolved = resolveAppearance('system');

        applyAppearance(resolved);
        useAppearanceStore.setState({ resolved });
    };

    query.addEventListener('change', onChange);
    stopFollowingSystem = () => {
        query.removeEventListener('change', onChange);
    };
};

/** Applies a preference to `<html>` and (un)subscribes to the system scheme; returns `resolved`. */
const followPreference = (preference: AppearancePreference): ResolvedAppearance => {
    stopFollowingSystem?.();
    stopFollowingSystem = null;

    const resolved = resolveAppearance(preference);

    applyAppearance(resolved);
    if (preference === 'system') {
        followSystem();
    }
    return resolved;
};

const loadAppearance = (): Pick<AppearanceStore, 'preference' | 'resolved'> => {
    const preference = readStoredPreference();

    return { preference, resolved: followPreference(preference) };
};

// Created (and applied to `<html>`) when `main` is imported, before the app's first render.
export const useAppearanceStore = create<AppearanceStore>(set => ({
    ...loadAppearance(),
    setPreference: preference => {
        LocalStorage.setRaw(LS_KEY_THEME, preference);
        set({ preference, resolved: followPreference(preference) });
    },
}));

export const selectResolvedAppearance = (state: AppearanceStore) => state.resolved;

export const selectSetPreference = (state: AppearanceStore) => state.setPreference;

/** Tests only: the store reads the saved preference again, as at startup. */
export const resetAppearanceStore = (): void => {
    useAppearanceStore.setState(loadAppearance());
};
