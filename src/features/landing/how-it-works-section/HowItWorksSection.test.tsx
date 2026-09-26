import { ThemeProvider } from 'styled-components';
import { expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';

import { lightThemeStyled } from 'constants/styled-themes';

import HowItWorksSection from './HowItWorksSection';

import 'i18n/index';

test('does not mention Solo on the public how-it-works section', () => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <HowItWorksSection />
        </ThemeProvider>,
    );

    expect(screen.queryByText(/solo/i)).toBeNull();
});
