import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import Footer from './Footer';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('assets/logo.svg?react', () => ({
    default: () => <svg aria-hidden="true" />,
}));

test('renders Telegram as a safe external media link', () => {
    render(<Footer />);

    expect(screen.getByText('footer.mediaTitle')).toBeTruthy();

    const telegramLink = screen.getByRole('link', { name: 'Telegram' });

    expect(telegramLink.getAttribute('href')).toBe('https://t.me/chipin_one');
    expect(telegramLink.getAttribute('target')).toBe('_blank');
    expect(telegramLink.getAttribute('rel')).toBe('noreferrer');
});
