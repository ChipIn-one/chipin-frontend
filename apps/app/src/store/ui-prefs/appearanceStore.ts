// Appearance (spec 05 §2): the single theme mechanism of the app. The preference is UI state
// (D3), saved as the raw string `light` | `dark` | `system` under LS_KEY_THEME (the format the
// former theme library wrote, so a saved choice survives). `resolved` drives the `light`/`dark`
// class on `<html>`, `<Theme appearance>` (AppTheme) and the Toaster. THEME_INIT_SCRIPT of
// `@chipin/tokens/theme-init` reads the same key before the app starts (no light frame in dark).
//
// Importing this module has no side effects: only the SPA calls `initAppearance()`, before its
// first render.
import { create } from 'zustand';

import { LS_KEY_THEME } from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';
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

/** The system dark-scheme query; null without `matchMedia` (jsdom, Node, very old browsers). */
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
    if (typeof document === 'undefined') {
        return;
    }
    const root = document.documentElement;

    root.classList.remove(resolved === 'dark' ? 'light' : 'dark');
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
};

/**
 * A saved value read as THEME_INIT_SCRIPT reads it, so the store keeps the class the script set:
 * no value is `system`; an unknown value or an unreadable storage (`undefined`) is `light`.
 */
const parseSavedPreference = (saved: string | null | undefined): AppearancePreference => {
    if (saved === null) {
        return 'system';
    }
    return PREFERENCES.find(preference => preference === saved) ?? 'light';
};

/** The saved preference (LS_KEY_THEME only). */
const readStoredPreference = (): AppearancePreference =>
    parseSavedPreference(LocalStorage.tryGetRaw(LS_KEY_THEME));

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

const initialState = (): Pick<AppearanceStore, 'preference' | 'resolved'> => {
    const preference = readStoredPreference();

    return { preference, resolved: resolveAppearance(preference) };
};

export const useAppearanceStore = create<AppearanceStore>(set => ({
    ...initialState(),
    setPreference: preference => {
        LocalStorage.setRaw(LS_KEY_THEME, preference);
        set({ preference, resolved: followPreference(preference) });
    },
}));

// Another tab changed the theme: follow it without writing it back.
// `key === null` is a `localStorage.clear()` there: the key is gone, as with a removal.
const onStorage = (event: StorageEvent): void => {
    if (event.key !== LS_KEY_THEME && event.key !== null) {
        return;
    }
    const preference = parseSavedPreference(event.newValue);

    useAppearanceStore.setState({ preference, resolved: followPreference(preference) });
};

let isInitialized = false;

/**
 * The SPA only, before its first render (`main`): applies the class to `<html>`, follows the
 * system scheme while the preference is `system`, and other tabs. Idempotent.
 */
export const initAppearance = (): void => {
    if (isInitialized) {
        return;
    }
    isInitialized = true;

    const preference = readStoredPreference();

    useAppearanceStore.setState({ preference, resolved: followPreference(preference) });
    window.addEventListener('storage', onStorage);
};

export const selectResolvedAppearance = (state: AppearanceStore) => state.resolved;

export const selectSetPreference = (state: AppearanceStore) => state.setPreference;

/** Tests only: back to the state at import (saved preference read again, not initialized). */
export const resetAppearanceStore = (): void => {
    stopFollowingSystem?.();
    stopFollowingSystem = null;
    if (isInitialized && typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
    }
    isInitialized = false;
    useAppearanceStore.setState(initialState());
};
