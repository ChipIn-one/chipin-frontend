import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CopyButton from './CopyButton';

const clipboardMocks = vi.hoisted(() => ({
    copyTextToClipboard: vi.fn(
        (): Promise<'copied' | 'unsupported'> => Promise.resolve('copied'),
    ),
}));

vi.mock('helpers/clipboard', () => ({
    copyTextToClipboard: clipboardMocks.copyTextToClipboard,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const COPY_LABEL = 'Copy code';

const renderButton = () =>
    render(
        <Theme>
            <CopyButton value="ABC-123" what="code">
                {COPY_LABEL}
            </CopyButton>
        </Theme>,
    );

beforeEach(() => {
    clipboardMocks.copyTextToClipboard.mockResolvedValue('copied');
});

test('copies the value and shows the copied state', () => {
    const user = userEvent.setup();
    renderButton();

    return user.click(screen.getByRole('button', { name: /copy code/i })).then(() => {
        expect(clipboardMocks.copyTextToClipboard).toHaveBeenCalledWith('ABC-123');
        expect(screen.getByRole('button', { name: /copy\.copied/i })).toBeTruthy();
    });
});

test('keeps the idle state when the clipboard is unavailable', () => {
    clipboardMocks.copyTextToClipboard.mockResolvedValue('unsupported');
    const user = userEvent.setup();
    renderButton();

    return user.click(screen.getByRole('button', { name: /copy code/i })).then(() => {
        expect(screen.getByRole('button', { name: /copy code/i })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /copy\.copied/i })).toBeNull();
    });
});
