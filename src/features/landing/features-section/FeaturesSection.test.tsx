import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import FeaturesSection from './FeaturesSection';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

test('does not expose the Solo budget feature on the public landing page', () => {
    render(<FeaturesSection />);

    expect(screen.queryByText('features.soloBudget.title')).toBeNull();
    expect(screen.queryByText('features.soloBudget.description')).toBeNull();
});
