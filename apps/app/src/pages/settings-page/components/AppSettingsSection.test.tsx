// #707: a theme chosen right after the app starts, before the session load of the self user has
// answered, is not reverted by that load and is saved. The #707 regression itself (a stale restored
// self entry, reconciled by the production restore handler) is the second test; the first test, its
// language variant and the newer-server-value test guard the pending-write/cancel path and that a
// newer server value with no newer local change still applies.
import { Theme } from '@radix-ui/themes';
import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { LS_KEY_THEME } from 'constants/localstorage';
import { type SelfUser, usersKeys } from 'entities/users';
import { getLocalUser, LocalStorage, saveLocalUser } from 'helpers/localStorage';
import { useSyncUserSettings } from 'hooks/useSyncUserSettings';
import { i18n } from 'i18n';
import { useAuthStore } from 'store/authStore';
import { loadSelfUserForSession } from 'store/sessionUser';
import { resetAppearanceStore } from 'store/ui-prefs';
import { runCacheRestoredHandler } from 'test/cacheRestored';
import { setupMswServer } from 'test/mswServer';
import { createTestQueryClient, getDefaultTestQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import fillStyles from 'basics/SegmentedControl.module.css';

import AppSettingsSection from './AppSettingsSection';
import RegionalSection from './RegionalSection';

import styles from './AppSettingsSection.module.css';

type ThemeName = SelfUser['settings']['theme'];

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'dark',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} satisfies SelfUser['settings'];

const userWith = (theme: ThemeName): SelfUser => ({
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Alex',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    settings: { ...settings, theme },
    createdAt: 1,
    updatedAt: 1,
});

const server = setupMswServer();

interface Backend {
    /** Answers the held `GET /users/self` with what the server held when it was sent. */
    answerLoad: () => void;
    /** The bodies of the `PATCH /users/self` requests, in order. */
    patches: unknown[];
}

/** The self user on the server; the session load is held until `answerLoad`. */
const serveBackend = (serverUser: { current: SelfUser }): Backend => {
    const held: (() => void)[] = [];
    const patches: unknown[] = [];

    server.use(
        http.get('*/users/self', async () => {
            const answer = serverUser.current;

            await new Promise<void>(resolve => {
                held.push(resolve);
            });
            return HttpResponse.json({ ...answer, isPremium: false });
        }),
        http.patch('*/users/self', async ({ request }) => {
            const body = (await request.json()) as { settings: Partial<SelfUser['settings']> };

            patches.push(body);
            serverUser.current = {
                ...serverUser.current,
                settings: { ...serverUser.current.settings, ...body.settings },
            };
            return HttpResponse.json({ ...serverUser.current, isPremium: false });
        }),
    );
    return {
        answerLoad: () => {
            held.splice(0).forEach(resolve => {
                resolve();
            });
        },
        patches,
    };
};

const RESTORED_AT = Date.now() - 60 * 60_000;

/**
 * The startup restore: the persisted self user is hydrated, then the restore handler runs through
 * the production chain (`restore` calls `runCacheRestored`; `initializeApi` wires the handler).
 */
const restoreSelf = (client: QueryClient, persisted: SelfUser): void => {
    const source = createTestQueryClient();

    source.setQueryData(usersKeys.self(), persisted, { updatedAt: RESTORED_AT });
    hydrate(client, dehydrate(source));
    runCacheRestoredHandler(client, persisted.id);
};

const SyncUserSettings = () => {
    useSyncUserSettings();
    return null;
};

const App = ({ children }: { children: ReactNode }) => (
    <Theme>
        <SyncUserSettings />
        {children}
    </Theme>
);

const settle = () =>
    act(
        () =>
            new Promise(resolve => {
                setTimeout(resolve, 20);
            }),
    );

const htmlTheme = (): string | undefined =>
    ['dark', 'light'].find(theme => document.documentElement.classList.contains(theme));

const cachedTheme = (client: QueryClient): ThemeName | undefined =>
    client.getQueryData<SelfUser>(usersKeys.self())?.settings.theme;

/** Signed in after the startup refresh: the session load is sent, the settings page shows. */
const startSession = (persisted: SelfUser): { client: QueryClient; loaded: Promise<unknown> } => {
    const client = mountAsUserClient('user-1', getDefaultTestQueryClient());

    restoreSelf(client, persisted);
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    const loaded = loadSelfUserForSession();

    render(
        <App>
            <AppSettingsSection isLoading={false} />
            <RegionalSection isLoading={false} />
        </App>,
    );
    return { client, loaded };
};

const browserLanguages = navigator.languages;

beforeEach(() => {
    document.documentElement.className = '';
    saveLocalUser({ id: 'user-1', role: 'USER', settings });
    LocalStorage.setRaw(LS_KEY_THEME, 'system');
    resetAppearanceStore();
});

afterEach(async () => {
    Object.defineProperty(navigator, 'languages', {
        configurable: true,
        value: browserLanguages,
    });
    await i18n.changeLanguage('en');
});

test('a theme chosen before the session load answers wins over that load and is saved', async () => {
    const backend = serveBackend({ current: userWith('dark') });
    const { client, loaded } = startSession(userWith('dark'));
    await settle();
    expect(htmlTheme()).toBe('dark');

    await userEvent.setup().click(screen.getByRole('radio', { name: /light/i }));
    await settle();
    expect(htmlTheme()).toBe('light');

    // The load read the user before the change; its answer arrives after the change.
    backend.answerLoad();
    await loaded;
    await settle();

    expect(backend.patches).toEqual([{ settings: { theme: 'light' } }]);
    expect(cachedTheme(client)).toBe('light');
    expect(getLocalUser()?.settings.theme).toBe('light');
    expect(htmlTheme()).toBe('light');
});

test('a language chosen before the session load answers wins over that load and is saved', async () => {
    Object.defineProperty(navigator, 'languages', { configurable: true, value: ['ru-RU'] });
    const backend = serveBackend({ current: userWith('dark') });
    const { client, loaded } = startSession(userWith('dark'));
    await settle();
    expect(i18n.language).toBe('en');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reset language' }));
    await settle();
    expect(i18n.language).toBe('ru');

    // The load read the user before the change; its answer arrives after the change.
    backend.answerLoad();
    await loaded;
    await settle();

    expect(backend.patches).toEqual([{ settings: { language: 'ru' } }]);
    expect(client.getQueryData<SelfUser>(usersKeys.self())?.settings.language).toBe('ru');
    expect(getLocalUser()?.settings.language).toBe('ru');
    expect(i18n.language).toBe('ru');
});

// The restored self user can be older than the saved theme (the cache is persisted throttled): the
// control must show the saved theme, so that an early click is a change, not a no-op the load undoes.
test('after a restore older than the saved theme, an early change is not reverted by the load', async () => {
    const backend = serveBackend({ current: userWith('dark') });
    const { client, loaded } = startSession(userWith('light'));
    await settle();
    expect(screen.getByRole('radio', { name: /dark/i }).getAttribute('aria-checked')).toBe('true');

    await userEvent.setup().click(screen.getByRole('radio', { name: /light/i }));
    backend.answerLoad();
    await loaded;
    await settle();

    expect(backend.patches).toEqual([{ settings: { theme: 'light' } }]);
    expect(cachedTheme(client)).toBe('light');
    expect(htmlTheme()).toBe('light');
});

test('a newer server value with no newer local change still applies', async () => {
    // Changed on another device: the server holds light, this device restored dark.
    const backend = serveBackend({ current: userWith('light') });
    const { client, loaded } = startSession(userWith('dark'));
    await settle();
    expect(htmlTheme()).toBe('dark');

    backend.answerLoad();
    await loaded;
    await settle();

    expect(backend.patches).toEqual([]);
    expect(cachedTheme(client)).toBe('light');
    expect(htmlTheme()).toBe('light');
});

// #316: the theme control fills the card (basics `fill`), so it never overflows a narrow phone; the
// icons carry the class the container query hides below 360px. jsdom has no layout: the widths are
// in AppSettingsSection.module.css, here the structure and the behaviour.
const THEME_LABELS = {
    en: ['Dark', 'Light', 'System'],
    ru: ['Тёмная', 'Светлая', 'Системная'],
} as const;

/** The settings card alone, with the self user restored and the session load answered. */
const renderThemeCard = async (): Promise<Backend> => {
    const backend = serveBackend({ current: userWith('dark') });
    const client = mountAsUserClient('user-1', getDefaultTestQueryClient());

    restoreSelf(client, userWith('dark'));
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    const loaded = loadSelfUserForSession();

    render(
        <Theme>
            <AppSettingsSection isLoading={false} />
        </Theme>,
    );
    await settle();
    backend.answerLoad();
    await loaded;
    await settle();
    return backend;
};

const themeRootOf = (label: string): HTMLElement => {
    const root = screen.getByRole('radio', { name: label }).closest('.rt-SegmentedControlRoot');
    if (!(root instanceof HTMLElement)) {
        throw new Error('SegmentedControl root not found');
    }
    return root;
};

test.each(['en', 'ru'] as const)(
    '#316: the theme control fills the card with its three options in %s',
    async language => {
        await i18n.changeLanguage(language);
        await renderThemeCard();

        const labels = THEME_LABELS[language];
        const root = themeRootOf(labels[0]);

        expect(fillStyles.fill).toBeTruthy();
        expect(root.classList).toContain(fillStyles.fill);
        expect(styles.themeControl).toBeTruthy();
        expect(root.classList).toContain(styles.themeControl);
        expect(screen.getAllByRole('radio')).toHaveLength(labels.length);
        for (const label of labels) {
            const option = screen.getByRole('radio', { name: label });

            expect(root.contains(option)).toBe(true);
            // Each label (active and inactive copy) has its icon with the hide-on-narrow class.
            expect(option.querySelectorAll(`svg.${styles.themeIcon}`).length).toBeGreaterThan(0);
            expect(option.querySelector(`.${styles.themeLabelText}`)?.textContent).toBe(label);
        }
        expect(screen.getByRole('radio', { name: labels[0] }).getAttribute('aria-checked')).toBe(
            'true',
        );
    },
);

test('#316: switching the theme in ru still saves it', async () => {
    await i18n.changeLanguage('ru');
    const backend = await renderThemeCard();

    await userEvent.setup().click(screen.getByRole('radio', { name: 'Системная' }));
    await settle();

    expect(backend.patches).toEqual([{ settings: { theme: 'system' } }]);
    expect(screen.getByRole('radio', { name: 'Системная' }).getAttribute('aria-checked')).toBe(
        'true',
    );
});
