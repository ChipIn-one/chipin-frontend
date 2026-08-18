import { ThemeProvider } from 'styled-components';
import { expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';

import { lightThemeStyled } from 'constants/styled-themes';

import LandingPreviewCard from './LandingPreviewCard';

const BUTTON_LABEL = 'Edit';

test('keeps preview content inside a non-interactive boundary', () => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <LandingPreviewCard label="Group application preview">
                <button type="button">{BUTTON_LABEL}</button>
            </LandingPreviewCard>
        </ThemeProvider>,
    );

    const preview = screen.getByRole('img', { name: 'Group application preview' });

    expect(preview.getAttribute('inert')).toBeNull();
    expect(preview.querySelector('[inert]')).not.toBeNull();
    expect(preview.querySelector('button')?.textContent).toBe(BUTTON_LABEL);
});
