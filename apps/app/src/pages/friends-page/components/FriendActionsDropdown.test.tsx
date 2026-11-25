// KB NET-006 (#866): the friend menu's online-only items say why they are disabled offline.
import { Theme } from '@radix-ui/themes';
import { onlineManager } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test } from 'vitest';

import { currencyCode, fromUnits } from 'shared/money';
import { createKnownUser } from 'test/knownUsers';

import { FriendActionsDropdown } from './FriendActionsDropdown';

import 'i18n/index';

const HINT = 'An internet connection is required';
const friend = createKnownUser('friend-1');
const balance = { net: fromUnits(0n, currencyCode('USD')) };

afterEach(() => {
    act(() => {
        onlineManager.setOnline(true);
    });
});

const openMenu = async (): Promise<void> => {
    render(<FriendActionsDropdown friend={friend} balance={balance} />, { wrapper: Theme });
    await userEvent.setup().click(screen.getByRole('button'));
};

const item = (name: RegExp) => screen.getByRole('menuitem', { name });

test('NET-006: flag off, offline: Settle up and Remove friend are disabled with the hint', async () => {
    act(() => {
        onlineManager.setOnline(false);
    });
    await openMenu();

    for (const name of [/^Settle up/, /^Remove friend/]) {
        expect(item(name).getAttribute('aria-disabled')).toBe('true');
        expect(within(item(name)).getByText(HINT)).toBeTruthy();
    }
    // Not an online-only item: no hint.
    expect(within(item(/^Add expense/)).queryByText(HINT)).toBeNull();
});

test('NET-006: flag off, online: Settle up and Remove friend are enabled without the hint', async () => {
    await openMenu();

    for (const name of [/^Settle up/, /^Remove friend/]) {
        expect(item(name).getAttribute('aria-disabled')).toBeNull();
        expect(within(item(name)).queryByText(HINT)).toBeNull();
    }
});
