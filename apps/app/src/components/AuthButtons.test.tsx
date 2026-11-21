import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { afterEach, expect, test, vi } from 'vitest';

import { lightThemeStyled } from 'constants/styled-themes';

import { AuthButtons } from './AuthButtons';

import 'i18n/index';

vi.mock('assets/google-icon.svg?react', () => ({
    default: () => <svg aria-hidden="true" />,
}));

afterEach(() => {
    vi.unstubAllGlobals();
});

const renderAuthButtons = () =>
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <AuthButtons />
        </ThemeProvider>,
    );

test('keeps Google sign-in and hides the unfinished Apple sign-in button', () => {
    renderAuthButtons();

    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign in with Apple' })).toBeNull();
});

test('leaves for Google sign-in once and keeps the button busy while the page unloads', () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    renderAuthButtons();
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Sign in with Google' });

    expect(button.disabled).toBe(false);

    return user
        .click(button)
        .then(() => {
            expect(assign).toHaveBeenCalledOnce();
            expect(button.disabled).toBe(true);

            return user.click(button);
        })
        .then(() => {
            expect(assign).toHaveBeenCalledOnce();
        });
});
