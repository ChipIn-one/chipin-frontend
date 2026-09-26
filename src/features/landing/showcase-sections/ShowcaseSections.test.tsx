import { ThemeProvider } from 'styled-components';
import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { lightThemeStyled } from 'constants/styled-themes';

import ShowcaseSections from './ShowcaseSections';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

test('keeps the Group showcase without exposing a Solo release preview', () => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <ShowcaseSections />
        </ThemeProvider>,
    );

    expect(screen.getByLabelText('sections.groups.preview.label')).not.toBeNull();
    expect(screen.queryByLabelText('sections.expenses.preview.label')).toBeNull();
    expect(screen.queryByText('sections.groups.placeholder')).toBeNull();
});
