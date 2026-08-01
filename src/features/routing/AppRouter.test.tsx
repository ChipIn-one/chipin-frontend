import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';

import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';

import AppRouter from './AppRouter';

import 'i18n/index';

const { ACTIVITY_ROUTE_CONTENT, JOIN_ROUTE_CONTENT } = vi.hoisted(() => ({
    ACTIVITY_ROUTE_CONTENT: 'Activity route content',
    JOIN_ROUTE_CONTENT: 'Join route content',
}));

vi.mock('assets/logo.svg?react', () => ({
    default: () => <svg aria-hidden />,
}));

vi.mock('pages/ActivityPage', () => ({
    default: () => <main>{ACTIVITY_ROUTE_CONTENT}</main>,
}));

vi.mock('pages/GroupJoinPage', () => ({
    default: () => <main>{JOIN_ROUTE_CONTENT}</main>,
}));

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated' });
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
});

const renderRouter = (route: string) => {
    render(
        <MemoryRouter initialEntries={[route]}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <AppRouter />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );
};

test('wraps an internal activity route in the desktop sidebar layout', () => {
    renderRouter('/activity');

    return screen.findByText(ACTIVITY_ROUTE_CONTENT).then(() => {
        const sidebarLink = screen.getByRole('link', { name: 'Chipin Group' });
        const pageContent = screen.getByRole('main');

        expect(
            sidebarLink.compareDocumentPosition(pageContent) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });
});

test('keeps the Group Join route outside the desktop sidebar layout', () => {
    renderRouter('/group/join/invite-token');

    expect(screen.getByText(JOIN_ROUTE_CONTENT)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Chipin Group' })).toBeNull();
});
