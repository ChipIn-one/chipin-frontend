import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';

import { lightThemeStyled } from 'constants/styled-themes';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';

import SoloPage from './SoloPage';

import 'i18n/index';

test('renders the Solo dashboard layout with development placeholders', () => {
    useDashboardStore.setState({ appMode: APP_MODES.SOLO });

    render(
        <MemoryRouter initialEntries={['/solo']}>
            <ThemeProvider theme={lightThemeStyled}>
                <SoloPage />
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(screen.getByRole('switch', { name: 'Group mode' }).getAttribute('aria-checked')).toBe(
        'false',
    );
    expect(screen.getByText('Solo summary')).not.toBeNull();
    expect(screen.queryByText('Solo records')).toBeNull();
    expect(screen.getByText('Solo activity')).not.toBeNull();
    expect(screen.getAllByText('Still in development.')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull();
});
