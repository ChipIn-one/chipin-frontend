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

// #971: below `sm` only the name hides; the mode badge stays next to the logo.
test('hides only the project name below sm, not the mode badge', () => {
    render(
        <Theme>
            <ModeLogotype isSoloMode={false} />
        </Theme>,
    );

    expect(screen.getByText(PROJECT_NAME).closest('.rt-r-display-none')).not.toBeNull();
    expect(screen.getByText('Group').closest('.rt-r-display-none')).toBeNull();
});
