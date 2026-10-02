import { expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import InviteQRModal from './InviteQRModal';

const OPEN_QR_LABEL = 'Open QR';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('components/OfflineQRCode', () => ({
    default: ({ url }: { url: string }) => <div data-testid="qr-code">{url}</div>,
}));

test('shows invite QR content and closes from the footer action', () => {
    const user = userEvent.setup();

    render(
        <Theme>
            <InviteQRModal
                qrLink="https://chipin.one/friends/join/friend-token"
                content={{
                    title: 'Add me on ChipIn',
                    accessibleDescription: 'Friend invite QR code',
                    description: 'Scan to add me as a friend.',
                    subtitle: 'Scan to add me',
                }}
            >
                <button type="button">{OPEN_QR_LABEL}</button>
            </InviteQRModal>
        </Theme>,
    );

    return user
        .click(screen.getByRole('button', { name: OPEN_QR_LABEL }))
        .then(() => {
            expect(screen.getByRole('dialog')).not.toBeNull();
            expect(screen.getByText('Scan to add me as a friend.')).not.toBeNull();
            expect(screen.getByTestId('qr-code').textContent).toBe(
                'https://chipin.one/friends/join/friend-token',
            );

            return user.click(screen.getByText('buttons.close'));
        })
        .then(() =>
            waitFor(() => {
                expect(screen.queryByRole('dialog')).toBeNull();
            }),
        );
});
