// Spec 03 §2.9 (03-16a part C, #866): `<OnlineOnly>` and `<OnlineOnlyGroup>` around an online-only action
// (KB NET-006, NET-007).
import { Button, Dialog, Theme } from '@radix-ui/themes';
import { onlineManager } from '@tanstack/react-query';
import { act, render as renderBare, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ONLINE_ONLY_ACTIONS, type OnlineOnlyAction } from 'constants/onlineOnlyActions';
import { useAuthStore } from 'store/authStore';
import { useConnectivityStore } from 'store/connectivityStore';

import { OnlineOnly, OnlineOnlyGroup } from './index';

import 'i18n/index';

afterEach(() => {
    vi.unstubAllEnvs();
    act(() => {
        onlineManager.setOnline(true);
    });
    useAuthStore.setState({ sessionMode: 'online' });
    useConnectivityStore.setState({ mode: 'online' });
});

const SETTLE_UP = 'Settle up';
const CREATE = 'Create';
const DIALOG_TITLE = 'Create a group';
const DIALOG_TEXT = 'form';
const THEME = 'Theme';

// The app root's `Theme` provides the tooltips.
const render = (ui: React.ReactElement) => renderBare(ui, { wrapper: Theme });

const SAVE = 'Save';
const DELETE = 'Delete';

const expenseButton = (action: OnlineOnlyAction, label: string, canQueueOffline?: boolean) => (
    <OnlineOnly action={action} canQueueOffline={canQueueOffline}>
        <Button type="button">{label}</Button>
    </OnlineOnly>
);

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

describe('flag off (production): NET-006 entry points are blocked offline all the same', () => {
    test('NET-006: flag off, online: the child as it is, no wrapper', () => {
        const { container } = render(settleUpButton());

        expect(container.querySelector('[data-online-only]')).toBeNull();
        // The same markup as the bare button.
        expect(container.innerHTML).toBe(
            renderBare(<Button type="button">{SETTLE_UP}</Button>, { wrapper: Theme }).container
                .innerHTML,
        );
    });

    test('NET-006: flag off, offline: settle-up button is disabled with the hint; back online: enabled', async () => {
        act(() => {
            onlineManager.setOnline(false);
        });
        const { container } = render(settleUpButton());
        const isDisabled = () =>
            screen.getByRole('button', { name: 'Settle up' }).hasAttribute('disabled');
        const button = screen.getByRole('button', { name: 'Settle up' });

        expect(isDisabled()).toBe(true);
        expect(button.getAttribute('aria-disabled')).toBe('true');
        await userEvent.setup().tab();
        expect(document.activeElement).toBe(container.querySelector('[data-online-only]'));
        expect((await screen.findByRole('tooltip')).textContent).toContain(
            'An internet connection is required',
        );
        act(() => {
            onlineManager.setOnline(true);
        });
        expect(isDisabled()).toBe(false);
    });

    test('NET-006: flag off, offline: a trigger opens nothing', async () => {
        act(() => {
            onlineManager.setOnline(false);
        });
        const { container } = render(<DialogWithTrigger />);
        const button = screen.getByRole('button', { name: 'Create' });

        expect(button).toHaveProperty('disabled', true);
        await userEvent.setup().click(container.querySelector('[data-online-only]') ?? button);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    test('NET-006: flag off, an offline-cached session is blocked even with the network', () => {
        useAuthStore.setState({ sessionMode: 'offline-cached' });
        render(
            <>
                {settleUpButton()}
                {expenseButton(ONLINE_ONLY_ACTIONS.expenseSave, SAVE)}
            </>,
        );

        expect(screen.getByRole('button', { name: 'Settle up' })).toHaveProperty('disabled', true);
        expect(screen.getByRole('button', { name: SAVE })).toHaveProperty('disabled', true);
    });

    test('NET-006: flag off, offline: OnlineOnlyGroup puts its controls in a disabled fieldset', () => {
        act(() => {
            onlineManager.setOnline(false);
        });
        render(
            <OnlineOnlyGroup action={ONLINE_ONLY_ACTIONS.userSettings}>
                <button type="button">{THEME}</button>
            </OnlineOnlyGroup>,
        );

        expect(
            screen.getByRole('group', { name: 'An internet connection is required' }),
        ).toHaveProperty('disabled', true);
        expect(screen.getByRole('button', { name: 'Theme' }).matches(':disabled')).toBe(true);
    });

    test('NET-007: flag off, offline: the expense save and delete are disabled; online: enabled', () => {
        act(() => {
            onlineManager.setOnline(false);
        });
        render(
            <>
                {expenseButton(ONLINE_ONLY_ACTIONS.expenseSave, SAVE)}
                {expenseButton(ONLINE_ONLY_ACTIONS.expenseDelete, DELETE)}
            </>,
        );
        const isDisabled = (name: string) =>
            screen.getByRole('button', { name }).hasAttribute('disabled');

        expect([isDisabled(SAVE), isDisabled(DELETE)]).toEqual([true, true]);
        act(() => {
            onlineManager.setOnline(true);
        });
        expect([isDisabled(SAVE), isDisabled(DELETE)]).toEqual([false, false]);
    });

    test('NET-002: flag off, backend down (the network usable): nothing is blocked', () => {
        act(() => {
            onlineManager.setOnline(true);
        });
        useAuthStore.setState({ sessionMode: 'online' });
        useConnectivityStore.setState({ mode: 'backend-down' });
        const { container } = render(
            <>
                {settleUpButton()}
                {expenseButton(ONLINE_ONLY_ACTIONS.expenseSave, SAVE)}
                <OnlineOnlyGroup action={ONLINE_ONLY_ACTIONS.userSettings}>
                    <button type="button">{THEME}</button>
                </OnlineOnlyGroup>
            </>,
        );

        expect(container.querySelector('[data-online-only]')).toBeNull();
        expect(screen.getByRole('button', { name: 'Settle up' })).toHaveProperty('disabled', false);
        expect(screen.getByRole('button', { name: SAVE })).toHaveProperty('disabled', false);
        expect(screen.getByRole('button', { name: THEME })).toHaveProperty('disabled', false);
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

    test('NET-007: flag on, offline, the outbox can take them: the expense save and delete are not blocked, settle-up is', () => {
        flagOn();
        act(() => {
            onlineManager.setOnline(false);
        });
        const { container } = render(
            <>
                {settleUpButton()}
                {expenseButton(ONLINE_ONLY_ACTIONS.expenseSave, SAVE, true)}
                {expenseButton(ONLINE_ONLY_ACTIONS.expenseDelete, DELETE, true)}
            </>,
        );

        expect(screen.getByRole('button', { name: SAVE })).toHaveProperty('disabled', false);
        expect(screen.getByRole('button', { name: DELETE })).toHaveProperty('disabled', false);
        expect(screen.getByRole('button', { name: 'Settle up' })).toHaveProperty('disabled', true);
        expect(
            [...container.querySelectorAll('[data-online-only]')].map(node =>
                node.getAttribute('data-online-only'),
            ),
        ).toEqual(['settleUp']);
    });

    test('NET-007: flag on, offline, the outbox cannot take them: the expense save and delete are disabled with the hint', async () => {
        flagOn();
        act(() => {
            onlineManager.setOnline(false);
        });
        render(
            <>
                {expenseButton(ONLINE_ONLY_ACTIONS.expenseSave, SAVE)}
                {expenseButton(ONLINE_ONLY_ACTIONS.expenseDelete, DELETE, false)}
            </>,
        );

        expect(screen.getByRole('button', { name: SAVE })).toHaveProperty('disabled', true);
        expect(screen.getByRole('button', { name: DELETE })).toHaveProperty('disabled', true);
        await userEvent.setup().tab();
        expect((await screen.findByRole('tooltip')).textContent).toContain(
            'An internet connection is required',
        );
    });

    test('canQueueOffline does not exempt an action that is not an expense write', () => {
        flagOn();
        act(() => {
            onlineManager.setOnline(false);
        });
        render(
            <OnlineOnly action={ONLINE_ONLY_ACTIONS.settleUp} canQueueOffline>
                <Button type="button">{SETTLE_UP}</Button>
            </OnlineOnly>,
        );

        expect(screen.getByRole('button', { name: 'Settle up' })).toHaveProperty('disabled', true);
    });
});
