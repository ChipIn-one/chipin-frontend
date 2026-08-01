import { ThemeProvider } from 'styled-components';
import { expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';

import { PROJECT_NAME } from 'constants/chipin';
import { lightThemeStyled } from 'constants/styled-themes';

import ModeLogotype from './ModeLogotype';

import 'i18n/index';

vi.mock('assets/logo.svg?react', () => ({
    default: () => <svg aria-hidden />,
}));

test.each([
    { isSoloMode: false, mode: 'Group' },
    { isSoloMode: true, mode: 'Solo' },
])('shows the project name and $mode badge', ({ isSoloMode, mode }) => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <Theme>
                <ModeLogotype isSoloMode={isSoloMode} />
            </Theme>
        </ThemeProvider>,
    );

    expect(screen.getByText(PROJECT_NAME)).toBeTruthy();
    expect(screen.getByText(mode)).toBeTruthy();
});
