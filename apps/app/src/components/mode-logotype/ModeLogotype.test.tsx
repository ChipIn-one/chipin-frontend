import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { PROJECT_NAME } from 'constants/chipin';

import { ModeLogotype } from './ModeLogotype';

import 'i18n/index';

vi.mock('@chipin/tokens/assets/logo.svg?react', () => ({
    default: () => <svg aria-hidden />,
}));

test.each([
    { isSoloMode: false, mode: 'Group' },
    { isSoloMode: true, mode: 'Solo' },
])('shows the project name and $mode badge', ({ isSoloMode, mode }) => {
    render(
        <Theme>
            <ModeLogotype isSoloMode={isSoloMode} />
        </Theme>,
    );

    expect(screen.getByText(PROJECT_NAME)).toBeTruthy();
    expect(screen.getByText(mode)).toBeTruthy();
});
