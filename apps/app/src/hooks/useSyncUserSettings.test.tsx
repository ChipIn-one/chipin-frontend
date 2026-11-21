import { dehydrate, hydrate, QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, type MockInstance, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { LS_KEY_THEME } from 'constants/localstorage';
import { reconcileRestoredSelf, type SelfUser, usersKeys } from 'entities/users';
import { LocalStorage, saveLocalUser } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';
import { type AppearanceStore, resetAppearanceStore, useAppearanceStore } from 'store/ui-prefs';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';

import { useSyncUserSettings } from './useSyncUserSettings';

const setAppLanguage = vi.hoisted(() => vi.fn((_: string) => Promise.resolve()));
// The language i18next runs in now (`i18n.resolvedLanguage`).
const i18n = vi.hoisted(() => ({ resolvedLanguage: undefined as string | undefined }));
// The target of a language switch still in flight (`getPendingLanguage()`).
const pending = vi.hoisted(() => ({ language: null as string | null }));
const captureException = vi.hoisted(() => vi.fn());
const locale = vi.hoisted(() => ({
    matchLocale: vi.fn<(raw: string) => string | null>(() => 'en'),
    saveLocalePreference: vi.fn(),
}));

vi.mock('@sentry/react', () => ({
    captureException,
}));

vi.mock('helpers/locale', () => ({
    matchLocale: locale.matchLocale,
    saveLocalePreference: locale.saveLocalePreference,
}));

vi.mock('helpers/setAppLanguage', () => ({
    getPendingLanguage: () => pending.language,
    setAppLanguage,
}));

vi.mock('i18n', () => ({ i18n }));

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'light',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} satisfies UserSettings;

// The real appearance store; its `setPreference` is watched.
let setPreference: MockInstance<AppearanceStore['setPreference']>;

beforeEach(() => {
    vi.clearAllMocks();
    LocalStorage.setRaw(LS_KEY_THEME, 'system');
    resetAppearanceStore();
    setPreference = vi.spyOn(useAppearanceStore.getState(), 'setPreference');
    i18n.resolvedLanguage = undefined;
    pending.language = null;
    saveLocalUser({ role: 'ADMIN', settings });
});

const selfUser = (overrides: Partial<UserSettings>): SelfUser => ({
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token',
    settings: { ...settings, ...overrides },
    createdAt: 1,
    updatedAt: 1,
});

const seedSelfUser = (user: SelfUser) => {
    act(() => {
        getDefaultTestQueryClient().setQueryData(usersKeys.self(), user);
    });
};

test('does not reapply cached user settings after logout', () => {
    useAuthStore.setState({ status: 'unauthenticated' });

    renderHook(() => useSyncUserSettings());

    expect(setPreference).not.toHaveBeenCalled();
    expect(locale.saveLocalePreference).not.toHaveBeenCalled();
    expect(setAppLanguage).not.toHaveBeenCalled();
});

test('records locale sync failures', () => {
    const error = new Error('Failed to change language');
    setAppLanguage.mockRejectedValueOnce(error);
    useAuthStore.setState({ status: 'authenticated' });

    renderHook(() => useSyncUserSettings());

    return Promise.resolve().then(() => {
        expect(captureException).toHaveBeenCalledWith(error);
    });
});

test('applies cached user theme settings while the authenticated user is loading', () => {
    useAuthStore.setState({ status: 'authenticated' });

    renderHook(() => useSyncUserSettings());

    expect(setPreference).toHaveBeenCalledWith('light');
    // setAppLanguage saves the preference itself.
    expect(setAppLanguage).toHaveBeenCalledWith('en');
});

// Spec 04 §2.10: the language is switched only when the server one differs from the current one;
// the preference is still saved, as before.
test('keeps the current language when the server language equals it', () => {
    i18n.resolvedLanguage = 'en';
    useAuthStore.setState({ status: 'authenticated' });

    renderHook(() => useSyncUserSettings());

    expect(setAppLanguage).not.toHaveBeenCalled();
    expect(locale.saveLocalePreference).toHaveBeenCalledExactlyOnceWith('en');
});

// R1 L1: leaving a public page started a switch to `ru` (still loading) when the server says `en`,
// the active language: the UI must end in `en`, so `en` is switched to (the latest switch wins).
test('switches when the server language differs from a switch in flight', () => {
    i18n.resolvedLanguage = 'en';
    pending.language = 'ru';
    useAuthStore.setState({ status: 'authenticated' });

    renderHook(() => useSyncUserSettings());

    expect(setAppLanguage).toHaveBeenCalledExactlyOnceWith('en');
});

test('does not switch again to the target of a switch in flight', () => {
    i18n.resolvedLanguage = 'ru';
    pending.language = 'en';
    useAuthStore.setState({ status: 'authenticated' });

    renderHook(() => useSyncUserSettings());

    expect(setAppLanguage).not.toHaveBeenCalled();
    expect(locale.saveLocalePreference).toHaveBeenCalledExactlyOnceWith('en');
});

test('switches through setAppLanguage when the server language differs', () => {
    i18n.resolvedLanguage = 'ru';
    useAuthStore.setState({ status: 'authenticated' });

    renderHook(() => useSyncUserSettings());

    expect(setAppLanguage).toHaveBeenCalledExactlyOnceWith('en');
    expect(locale.saveLocalePreference).not.toHaveBeenCalled();
});

// #609: es, pt-BR and pt-PT were removed; a backend setting that still holds one
// is applied as English without an error and without changing the backend value.
test.each(['es', 'pt-BR', 'pt-PT', 'pt'])(
    'applies English for the removed saved language %s',
    language =>
        vi
            .importActual<{ matchLocale: (raw: string) => string | null }>('helpers/locale')
            .then(actual => {
                locale.matchLocale.mockImplementationOnce(actual.matchLocale);
                saveLocalUser({ role: 'USER', settings: { ...settings, language } });
                useAuthStore.setState({ status: 'authenticated' });

                renderHook(() => useSyncUserSettings());

                expect(locale.matchLocale).toHaveBeenCalledWith(language);
                expect(setAppLanguage).toHaveBeenCalledWith('en');
                expect(captureException).not.toHaveBeenCalled();
            }),
);

test('applies the self query settings over the cached user', () => {
    useAuthStore.setState({ status: 'authenticated' });
    locale.matchLocale.mockImplementation(raw => raw);
    seedSelfUser(selfUser({ language: 'ru', theme: 'dark' }));

    renderHook(() => useSyncUserSettings());

    expect(setPreference).toHaveBeenCalledWith('dark');
    expect(useAppearanceStore.getState().resolved).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(setAppLanguage).toHaveBeenCalledWith('ru');
});

// Spec 03 §6 row 3: the language comes from `select`, so a new settings object with the same
// language does not run the language sync again.
test('changes the language only when the language changes', () =>
    Promise.resolve().then(() => {
        useAuthStore.setState({ status: 'authenticated' });
        locale.matchLocale.mockImplementation(raw => raw);
        seedSelfUser(selfUser({ language: 'ru' }));
        renderHook(() => useSyncUserSettings());
        expect(setAppLanguage).toHaveBeenCalledTimes(1);

        seedSelfUser(selfUser({ language: 'ru', defaultCurrency: 'EUR' }));
        return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
            expect(setAppLanguage).toHaveBeenCalledTimes(1);
            expect(setPreference).toHaveBeenCalledTimes(1);

            seedSelfUser(selfUser({ language: 'en' }));
            return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
                expect(setAppLanguage).toHaveBeenCalledTimes(2);
                expect(setAppLanguage).toHaveBeenLastCalledWith('en');
            });
        });
    }));

// #719: the persisted cache is saved throttled, so a reload right after a settings write can
// restore a self user older than the cached `LocalUser`, written at once on every confirmed value.
// After the restore the entry takes this user's cached language and theme and keeps its update
// time; the session load replaces it with the server value.
const RESTORED_AT = Date.now() - 60_000;

/** Seeds the self user the way the restore does: dehydrated, then hydrated into the client. */
const restoreSelfUser = (user: SelfUser) => {
    const source = new QueryClient();
    source.setQueryData(usersKeys.self(), user, { updatedAt: RESTORED_AT });
    act(() => {
        hydrate(getDefaultTestQueryClient(), dehydrate(source));
        reconcileRestoredSelf(getDefaultTestQueryClient(), 'user-1');
    });
};

const cachedRu = { ...settings, language: 'ru', theme: 'dark', defaultCurrency: 'EUR' } as const;

test.each([
    ['another user', { id: 'user-2', role: 'USER', settings: cachedRu }],
    ['no user id', { settings: cachedRu }],
] as const)('a restored self user keeps its settings when the cached user is %s', (_, cached) => {
    useAuthStore.setState({ status: 'authenticated' });
    locale.matchLocale.mockImplementation(raw => raw);
    saveLocalUser(cached);
    restoreSelfUser(selfUser({ language: 'en', theme: 'light' }));

    renderHook(() => useSyncUserSettings());

    expect(setAppLanguage).toHaveBeenLastCalledWith('en');
    expect(setPreference).toHaveBeenLastCalledWith('light');
});

test('a restored self user takes only the cached language and theme, and keeps its update time', () => {
    saveLocalUser({ id: 'user-1', role: 'USER', settings: cachedRu });
    restoreSelfUser(selfUser({ language: 'en', theme: 'light' }));

    const client = getDefaultTestQueryClient();
    expect(client.getQueryData<SelfUser>(usersKeys.self())?.settings).toEqual({
        ...settings,
        language: 'ru',
        theme: 'dark',
    });
    expect(client.getQueryState(usersKeys.self())?.dataUpdatedAt).toBe(RESTORED_AT);
});

test('a restored invalidated self user stays invalidated after it takes the cached settings', () => {
    saveLocalUser({ id: 'user-1', role: 'USER', settings: cachedRu });
    const source = new QueryClient();
    source.setQueryData(usersKeys.self(), selfUser({ language: 'en' }), { updatedAt: RESTORED_AT });
    // What `updateSelf` `onError` leaves after the session ended: the entry marked for a reload.
    void source.invalidateQueries({ queryKey: usersKeys.self(), refetchType: 'none' });
    const client = getDefaultTestQueryClient();

    act(() => {
        hydrate(client, dehydrate(source));
    });
    expect(client.getQueryState(usersKeys.self())?.isInvalidated).toBe(true);
    act(() => {
        reconcileRestoredSelf(client, 'user-1');
    });

    expect(client.getQueryData<SelfUser>(usersKeys.self())?.settings.language).toBe('ru');
    expect(client.getQueryState(usersKeys.self())?.isInvalidated).toBe(true);
    expect(client.getQueryState(usersKeys.self())?.dataUpdatedAt).toBe(RESTORED_AT);
});

test('a restored self user does not override the newer cached language and theme', () => {
    useAuthStore.setState({ status: 'authenticated' });
    locale.matchLocale.mockImplementation(raw => raw);
    saveLocalUser({ id: 'user-1', role: 'USER', settings: cachedRu });
    restoreSelfUser(selfUser({ language: 'en', theme: 'light' }));

    renderHook(() => useSyncUserSettings());

    expect(setAppLanguage).toHaveBeenCalledWith('ru');
    expect(setAppLanguage).not.toHaveBeenCalledWith('en');
    expect(locale.saveLocalePreference).not.toHaveBeenCalledWith('en');
    expect(setPreference).toHaveBeenCalledWith('dark');
    expect(setPreference).not.toHaveBeenCalledWith('light');
});

test('an optimistic change on the restored self user keeps the cached language', () =>
    Promise.resolve().then(() => {
        useAuthStore.setState({ status: 'authenticated' });
        locale.matchLocale.mockImplementation(raw => raw);
        saveLocalUser({ id: 'user-1', role: 'USER', settings: cachedRu });
        restoreSelfUser(selfUser({ language: 'en', theme: 'light' }));
        renderHook(() => useSyncUserSettings());

        // What `onMutate` writes: the cached entry with one change, at the current time.
        const client = getDefaultTestQueryClient();
        const base = client.getQueryData<SelfUser>(usersKeys.self());
        act(() => {
            if (base) {
                client.setQueryData(usersKeys.self(), {
                    ...base,
                    settings: { ...base.settings, theme: 'system' },
                });
            }
        });
        return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
            expect(setAppLanguage).not.toHaveBeenCalledWith('en');
            expect(setPreference).toHaveBeenLastCalledWith('system');
        });
    }));

test('a server value loaded after the restore applies over the cached user', () =>
    Promise.resolve().then(() => {
        useAuthStore.setState({ status: 'authenticated' });
        locale.matchLocale.mockImplementation(raw => raw);
        saveLocalUser({ id: 'user-1', role: 'USER', settings: cachedRu });
        restoreSelfUser(selfUser({ language: 'en', theme: 'light' }));
        renderHook(() => useSyncUserSettings());

        // Changed on another device: the refetch brings a newer server value.
        seedSelfUser(selfUser({ language: 'de', theme: 'light' }));
        return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
            expect(setAppLanguage).toHaveBeenLastCalledWith('de');
            expect(setPreference).toHaveBeenLastCalledWith('light');
        });
    }));
