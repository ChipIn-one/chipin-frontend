import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import SoloPreferencesSection from './SoloPreferencesSection';

import 'i18n/index';

test('renders the two Solo preference switches in their own section', () => {
    render(<SoloPreferencesSection isLoading={false} />);

    expect(screen.getByRole('switch', { name: 'Solo Mode by default' })).not.toBeNull();
    expect(screen.getByRole('switch', { name: 'Save group expenses to Solo' })).not.toBeNull();
});
