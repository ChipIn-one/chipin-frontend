import { MemoryRouter, useLocation } from 'react-router-dom';
import { expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BackButton from './BackButton';

const CurrentPath = () => {
    const location = useLocation();

    return <span>{location.pathname}</span>;
};

test('navigates to the previous history entry', () => {
    const user = userEvent.setup();

    render(
        <MemoryRouter
            initialEntries={['/dashboard', '/group/group-1']}
            initialIndex={1}
        >
            <BackButton />
            <CurrentPath />
        </MemoryRouter>,
    );

    expect(screen.getByText('/group/group-1')).toBeTruthy();

    return user
        .click(screen.getByRole('button', { name: /back/i }))
        .then(() => {
            expect(screen.getByText('/dashboard')).toBeTruthy();
        });
});
