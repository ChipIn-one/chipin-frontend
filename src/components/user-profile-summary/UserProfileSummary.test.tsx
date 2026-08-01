import { ThemeProvider } from 'styled-components';
import { expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { UserSummary } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';

import UserProfileSummary from './UserProfileSummary';

import 'i18n/index';

const user = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Alex',
    firstName: null,
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
} satisfies UserSummary;

test('shows the current user identity', () => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <UserProfileSummary user={user} />
        </ThemeProvider>,
    );

    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('user@example.com')).toBeTruthy();
});
