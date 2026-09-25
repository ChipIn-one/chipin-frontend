import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AuthModal from './AuthModal';

vi.mock('assets/google-icon.svg?react', () => ({
    default: () => <svg aria-hidden="true" />,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'button.google': 'Sign in with Google',
                'buttons.close': 'Close',
                'modal.headlineAccent': 'without the mess.',
                'modal.headlinePrimary': 'Split shared spending',
                'modal.title': 'Welcome to ChipIn',
                'modal.trust': 'Secure sign-in with Google. No spam.',
            };

            return translations[key] ?? key;
        },
    }),
}));

const OPEN_SIGN_IN_LABEL = 'Open sign in';

test('renders the approved mobile sign-in composition without the old intro block', () => {
    const user = userEvent.setup();

    render(
        <AuthModal>
            <button type="button">{OPEN_SIGN_IN_LABEL}</button>
        </AuthModal>,
    );

    return user.click(screen.getByRole('button', { name: OPEN_SIGN_IN_LABEL })).then(() => {
        expect(screen.getByRole('dialog', { name: 'Welcome to ChipIn' })).toBeTruthy();
        expect(
            screen.getByRole('heading', {
                name: 'Split shared spending without the mess.',
            }),
        ).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
        expect(
            screen.getByText('Secure sign-in with Google. No spam.', { selector: 'span' }),
        ).toBeTruthy();
        expect(
            screen.queryByText('Sign in to track and split expenses with your friends'),
        ).toBeNull();
    });
});
