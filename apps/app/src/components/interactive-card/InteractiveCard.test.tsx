import { Card } from '@radix-ui/themes';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

import { InteractiveCard } from './InteractiveCard';

// NavButton is still styled-components; its theme colour is a fallback behind `--cp-focus-ring`,
// so the test needs no styled ThemeProvider (new files may not import styled-components).
vi.mock('helpers/colors', () => ({ themeColor: () => () => 'transparent' }));

const CARD_CONTENT = 'Card content';
const TARGET_PAGE = 'Target page';

const renderCard = (onClick = vi.fn()) =>
    render(
        <MemoryRouter initialEntries={['/start']}>
            <Routes>
                <Route
                    path="/start"
                    element={
                        <InteractiveCard to="/target" aria-current="page" onClick={onClick}>
                            <Card data-interactive-card>{CARD_CONTENT}</Card>
                        </InteractiveCard>
                    }
                />
                <Route path="/target" element={<p>{TARGET_PAGE}</p>} />
            </Routes>
        </MemoryRouter>,
    );

test('renders a link around the marked card surface', () => {
    const { container } = renderCard();
    const link = screen.getByRole('link');

    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.querySelector('[data-interactive-card]')?.textContent).toBe(CARD_CONTENT);
    expect(container.querySelectorAll('[data-interactive-card]')).toHaveLength(1);
});

test('navigates to its target and calls the caller click handler', () => {
    const onClick = vi.fn();

    renderCard(onClick);
    fireEvent.click(screen.getByRole('link'));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText(TARGET_PAGE)).toBeTruthy();
});
