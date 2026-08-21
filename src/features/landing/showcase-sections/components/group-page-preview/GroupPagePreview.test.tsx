import { ThemeProvider } from 'styled-components';
import { expect, test, vi } from 'vitest';

import { fireEvent, render, screen, within } from '@testing-library/react';

import { lightThemeStyled } from 'constants/styled-themes';

import GroupPagePreview from './GroupPagePreview';
import { GROUP_PREVIEW_MEMBERS } from './internal';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { payer?: string }) =>
            key === 'activity:event.paidAmount' ? `${options?.payer} paid` : key,
    }),
}));

test('renders the mobile Group preview with exactly three expenses', () => {
    const { container } = render(
        <ThemeProvider theme={lightThemeStyled}>
            <GroupPagePreview />
        </ThemeProvider>,
    );

    expect(
        screen.getByRole('img', {
            name: 'sections.groups.preview.label',
        }),
    ).not.toBeNull();
    const loadingCover = screen.getByAltText(
        'sections.groups.preview.coverAlt',
    );

    fireEvent.load(loadingCover);

    const cover = screen.getByRole('img', {
        name: 'sections.groups.preview.coverAlt',
    });

    expect(cover.getAttribute('src')).toContain('photo-1646590126631-c3c01f631b74');
    expect(GROUP_PREVIEW_MEMBERS.map(({ picture }) => picture)).toEqual([
        'https://randomuser.me/api/portraits/women/44.jpg',
        'https://randomuser.me/api/portraits/men/32.jpg',
        'https://randomuser.me/api/portraits/women/65.jpg',
        'https://randomuser.me/api/portraits/men/75.jpg',
    ]);
    expect(screen.getByText('sections.groups.preview.groupName')).not.toBeNull();
    const description = screen.getByText('sections.groups.preview.groupDescription');

    expect(description.getAttribute('data-accent-color')).toBeNull();
    expect(getComputedStyle(description).color).toBe('rgb(255, 255, 255)');
    const owedSummary = screen.getByText('summary.owedToYou');

    expect(owedSummary.parentElement?.parentElement?.textContent).toContain('227');
    expect(screen.queryByText('summary.youOwe')).toBeNull();
    expect(container.querySelector('.rt-Separator')).not.toBeNull();
    expect(screen.getByText('balances.youAreOwed').textContent).toContain('227');

    const expenses = screen.getByRole('list', {
        name: 'sections.groups.preview.expensesLabel',
    });

    const [hotel, dinner, tickets] = within(expenses).getAllByRole('listitem');

    expect(within(hotel).getByText('activity:event.you paid')).not.toBeNull();
    expect(within(dinner).getByText('Aleh paid')).not.toBeNull();
    expect(within(tickets).getByText('activity:event.you paid')).not.toBeNull();

    return Promise.all([
        within(hotel).findByLabelText('sections.groups.preview.expenses.hotel'),
        within(dinner).findByLabelText('sections.groups.preview.expenses.dinner'),
        within(tickets).findByLabelText('sections.groups.preview.expenses.tickets'),
    ]).then(([hotelIcon, dinnerIcon, ticketsIcon]) => {
        expect(hotelIcon.classList.contains('lucide-hotel')).toBe(true);
        expect(dinnerIcon.classList.contains('lucide-utensils-crossed')).toBe(true);
        expect(ticketsIcon.classList.contains('lucide-train-front')).toBe(true);
        expect(hotelIcon.closest('[data-accent-color]')?.getAttribute('data-accent-color')).toBe(
            'green',
        );
        expect(dinnerIcon.closest('[data-accent-color]')?.getAttribute('data-accent-color')).toBe(
            'red',
        );
        expect(ticketsIcon.closest('[data-accent-color]')?.getAttribute('data-accent-color')).toBe(
            'green',
        );
    });
});
