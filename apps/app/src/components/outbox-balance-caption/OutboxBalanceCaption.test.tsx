import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import type { OutboxOverlay } from 'entities/ledger';
import { useOutboxSheetStore } from 'store/outboxSheetStore';

import { OutboxBalanceCaption } from './index';

import 'i18n/index';

const ledger = vi.hoisted(() => ({ count: null as number | null }));

// The real overlay unless a test sets a count (flag off: the real one is the empty view).
vi.mock('entities/ledger', async importOriginal => {
    const actual = await importOriginal<typeof import('entities/ledger')>();

    return {
        ...actual,
        useOutboxOverlay: (): OutboxOverlay => {
            const real = actual.useOutboxOverlay();

            return ledger.count === null ? real : { ...real, count: ledger.count };
        },
    };
});

afterEach(() => {
    ledger.count = null;
    useOutboxSheetStore.setState({ isOpen: false });
});

test('03-16a part B flag off = master: no caption is rendered', () => {
    const { container } = render(<OutboxBalanceCaption />);

    expect(container.innerHTML).toBe('');
});

test('§3: with unsent ops the balance says it excludes them; the counter opens OutboxSheet', async () => {
    ledger.count = 2;
    render(<OutboxBalanceCaption />);

    expect(screen.getByText('Excluding unsent operations')).toBeTruthy();
    await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Unsent operations: 2. Open the list' }));
    expect(useOutboxSheetStore.getState().isOpen).toBe(true);
});
