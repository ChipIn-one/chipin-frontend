import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import BaseModal from './BaseModal';

const EXAMPLE_CONTENT = 'Example content';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

test('exposes a translated close action for an open dialog', () => {
    render(
        <BaseModal
            isOpened
            setIsOpened={vi.fn()}
            title="Example title"
            accessibleDescription="Example description"
            content={<p>{EXAMPLE_CONTENT}</p>}
        />,
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'buttons.close' })).toBeTruthy();
});
