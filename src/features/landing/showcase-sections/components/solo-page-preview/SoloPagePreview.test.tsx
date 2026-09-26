import { ThemeProvider } from 'styled-components';
import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { lightThemeStyled } from 'constants/styled-themes';

import SoloPagePreview from './SoloPagePreview';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

test('mirrors the current Solo page empty states without its header', () => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <SoloPagePreview />
        </ThemeProvider>,
    );

    expect(screen.getByLabelText('sections.expenses.preview.label')).not.toBeNull();
    expect(screen.getByText('solo.summaryTitle')).not.toBeNull();
    expect(screen.getByText('solo.activityTitle')).not.toBeNull();
    expect(screen.getAllByText('solo.inDevelopment')).toHaveLength(2);
    expect(screen.queryByText('header.greeting')).toBeNull();
});
