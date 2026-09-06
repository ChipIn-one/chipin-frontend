import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { lightThemeStyled } from 'constants/styled-themes';
import { useLoadingStore } from 'store/loadingStore';

import AuthButtons from './AuthButtons';

import 'i18n/index';

vi.mock('assets/google-icon.svg?react', () => ({
    default: () => <svg aria-hidden="true" />,
}));

beforeEach(() => {
    useLoadingStore.getState().setInitialLoadingStore();
});

test('keeps Google sign-in and hides the unfinished Apple sign-in button', () => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <AuthButtons />
        </ThemeProvider>,
    );

    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign in with Apple' })).toBeNull();
});
