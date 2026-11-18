// Spec 03 §2.9 (03-16a part C): `<OnlineOnly>` and `<OnlineOnlyGroup>` around an online-only action.
import { Button, Dialog, Theme } from '@radix-ui/themes';
import { onlineManager } from '@tanstack/react-query';
import { act, render as renderBare, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ONLINE_ONLY_ACTIONS } from 'constants/onlineOnlyActions';
import { useAuthStore } from 'store/authStore';

import { OnlineOnly, OnlineOnlyGroup } from './index';

import 'i18n/index';

afterEach(() => {
    vi.unstubAllEnvs();
    act(() => {
        onlineManager.setOnline(true);
    });
    useAuthStore.setState({ sessionMode: 'online' });
});

const SETTLE_UP = 'Settle up';
const CREATE = 'Create';
const DIALOG_TITLE = 'Create a group';
const DIALOG_TEXT = 'form';
const THEME = 'Theme';

// The app root's `Theme` provides the tooltips.
const render = (ui: React.ReactElement) => renderBare(ui, { wrapper: Theme });

const flagOn = (): void => {
    vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
};

const settleUpButton = () => (
    <OnlineOnly action={ONLINE_ONLY_ACTIONS.settleUp}>
        <Button type="button">{SETTLE_UP}</Button>
    </OnlineOnly>
);

// A trigger (`asChild`) whose child is the wrapper, as the modals render it.
const DialogWithTrigger = () => (
    <Dialog.Root>
        <Dialog.Trigger>
            <OnlineOnly action={ONLINE_ONLY_ACTIONS.groupCreate}>
                <Button type="button">{CREATE}</Button>
            </OnlineOnly>
        </Dialog.Trigger>
        <Dialog.Content>
            <Dialog.Title>{DIALOG_TITLE}</Dialog.Title>
            <Dialog.Description>{DIALOG_TEXT}</Dialog.Description>
        </Dialog.Content>
    </Dialog.Root>
);

describe('flag off = master: the child as it is, whatever the network', () => {
    test('offline and offline-cached: not disabled, no wrapper', () => {
        act(() => {
            onlineManager.setOnline(false);
        });
        useAuthStore.setState({ sessionMode: 'offline-cached' });
        const { container } = render(settleUpButton());
        const button = screen.getByRole('button', { name: 'Settle up' });

        expect(button).toHaveProperty('disabled', false);
        expect(button.getAttribute('aria-disabled')).toBeNull();
        expect(container.querySelector('[data-online-only]')).toBeNull();
        // The same markup as the bare button.
        expect(container.innerHTML).toBe(
            renderBare(<Button type="button">{SETTLE_UP}</Button>, { wrapper: Theme }).container
                .innerHTML,
        );
    });

    test('a trigger opens its dialog offline', async () => {
        act(() => {
            onlineManager.setOnline(false);
        });
        render(<DialogWithTrigger />);

        await userEvent.setup().click(screen.getByRole('button', { name: 'Create' }));

        expect(await screen.findByRole('dialog')).toBeTruthy();
    });

    test('OnlineOnlyGroup renders no fieldset offline', () => {
        act(() => {
            onlineManager.setOnline(false);
        });
        const { container } = render(
            <OnlineOnlyGroup action={ONLINE_ONLY_ACTIONS.userSettings}>
                <button type="button">{THEME}</button>
            </OnlineOnlyGroup>,
        );

        expect(container.querySelector('fieldset')).toBeNull();
        expect(screen.getByRole('button', { name: 'Theme' })).toHaveProperty('disabled', false);
    });
});

describe('flag on', () => {
    test('online: the child as it is; a trigger opens its dialog', async () => {
        flagOn();
        const { container } = render(<DialogWithTrigger />);
        const button = screen.getByRole('button', { name: 'Create' });

        expect(container.querySelector('[data-online-only]')).toBeNull();
        await userEvent.setup().click(button);
        expect(await screen.findByRole('dialog')).toBeTruthy();
    });

    test('offline: disabled + aria-disabled, the tooltip says why, the trigger opens nothing', async () => {
        flagOn();
        act(() => {
            onlineManager.setOnline(false);
        });
        const { container } = render(<DialogWithTrigger />);
        const button = screen.getByRole('button', { name: 'Create' });
        const user = userEvent.setup();

        expect(button).toHaveProperty('disabled', true);
        expect(button.getAttribute('aria-disabled')).toBe('true');
        await user.tab();
        expect(document.activeElement).toBe(container.querySelector('[data-online-only]'));
        expect((await screen.findByRole('tooltip')).textContent).toContain(
            'An internet connection is required',
        );
        await user.click(container.querySelector('[data-online-only]') ?? button);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    test('an offline-cached session is blocked even with the network', () => {
        flagOn();
        useAuthStore.setState({ sessionMode: 'offline-cached' });
        render(settleUpButton());

        expect(screen.getByRole('button', { name: 'Settle up' })).toHaveProperty('disabled', true);
    });

    test('reacts to the network: blocked while offline, back once online', () => {
        flagOn();
        render(settleUpButton());
        const isDisabled = () =>
            screen.getByRole('button', { name: 'Settle up' }).hasAttribute('disabled');

        expect(isDisabled()).toBe(false);
        act(() => {
            onlineManager.setOnline(false);
        });
        expect(isDisabled()).toBe(true);
        act(() => {
            onlineManager.setOnline(true);
        });
        expect(isDisabled()).toBe(false);
    });

    test('OnlineOnlyGroup offline: its controls sit in a disabled fieldset that says why', () => {
        flagOn();
        act(() => {
            onlineManager.setOnline(false);
        });
        render(
            <OnlineOnlyGroup action={ONLINE_ONLY_ACTIONS.userSettings}>
                <button type="button">{THEME}</button>
            </OnlineOnlyGroup>,
        );
        const fieldset = screen.getByRole('group', { name: 'An internet connection is required' });

        expect(fieldset).toHaveProperty('disabled', true);
        expect(screen.getByRole('button', { name: 'Theme' }).matches(':disabled')).toBe(true);
    });
});
