import { expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import GroupQRModal from './GroupQRModal';

const OPEN_QR_LABEL = 'Open QR';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: { groupName?: string }) =>
            params?.groupName ? `${key}:${params.groupName}` : key,
    }),
}));

vi.mock('components/OfflineQRCode', () => ({
    default: ({ url }: { url: string }) => <div data-testid="qr-code">{url}</div>,
}));

test('shows the group join hint and closes from the footer action', () => {
    const user = userEvent.setup();

    render(
        <Theme>
            <GroupQRModal
                qrLink="https://chipin.one/invite/group-1"
                groupName="Vietnam"
            >
                <button type="button">{OPEN_QR_LABEL}</button>
            </GroupQRModal>
        </Theme>,
    );

    return user
        .click(screen.getByRole('button', { name: OPEN_QR_LABEL }))
        .then(() => {
            expect(screen.getByRole('dialog')).not.toBeNull();
            expect(screen.getByText('group:qr.joinDescription:Vietnam')).not.toBeNull();
            expect(screen.getByTestId('qr-code').textContent).toBe(
                'https://chipin.one/invite/group-1',
            );

            const closeButton = screen.getByRole('button', {
                name: 'common:buttons.close',
            });

            return user.click(closeButton);
        })
        .then(() =>
            waitFor(() => {
                expect(screen.queryByRole('dialog')).toBeNull();
            }),
        );
});
