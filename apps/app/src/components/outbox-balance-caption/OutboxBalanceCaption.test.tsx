import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { OutboxOverlay } from 'entities/ledger';
import { i18n } from 'i18n';
import { useOutboxSheetStore } from 'store/outboxSheetStore';

import { OutboxBalanceCaption } from './index';

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

afterEach(async () => {
    await i18n.changeLanguage('en');
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
        .click(screen.getByRole('button', { name: '2 unsent operations, open the list' }));
    expect(useOutboxSheetStore.getState().isOpen).toBe(true);
});

describe('R2 N1: the counter names the operations in the plural form of N', () => {
    test.each([
        ['en', 1, '1 unsent operation, open the list'],
        ['en', 3, '3 unsent operations, open the list'],
        ['ru', 1, '1 неотправленная операция, открыть список'],
        ['ru', 3, '3 неотправленные операции, открыть список'],
        ['ru', 5, '5 неотправленных операций, открыть список'],
    ])('%s, %i', async (language, count, name) => {
        await act(() => i18n.changeLanguage(language));
        ledger.count = count;
        render(<OutboxBalanceCaption />);

        expect(screen.getByRole('button', { name })).toBeTruthy();
    });
});
