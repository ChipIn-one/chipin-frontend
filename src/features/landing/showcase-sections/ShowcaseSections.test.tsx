import { ThemeProvider } from 'styled-components';
import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { lightThemeStyled } from 'constants/styled-themes';

import ShowcaseSections from './ShowcaseSections';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

test('replaces both landing showcase placeholders with app previews', () => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <ShowcaseSections />
        </ThemeProvider>,
    );

    expect(screen.getByLabelText('sections.groups.preview.label')).not.toBeNull();
    expect(screen.getByLabelText('sections.expenses.preview.label')).not.toBeNull();
    expect(screen.queryByText('sections.groups.placeholder')).toBeNull();
    expect(screen.queryByText('sections.expenses.placeholder')).toBeNull();
});
