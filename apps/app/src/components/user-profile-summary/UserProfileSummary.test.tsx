import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import type { UserSummary } from 'api/chipin.types';

import { UserProfileSummary } from './UserProfileSummary';

import 'i18n/index';

const user = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Alex',
    firstName: null,
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
} satisfies UserSummary;

test('shows the current user identity', () => {
    const { container } = render(<UserProfileSummary user={user} />);

    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('user@example.com')).toBeTruthy();
    expect(container.querySelector('.rt-AvatarRoot')?.classList.contains('rt-r-size-5')).toBe(true);
});

test('uses the requested avatar size', () => {
    const { container } = render(<UserProfileSummary user={user} avatarSize="4" />);

    expect(container.querySelector('.rt-AvatarRoot')?.classList.contains('rt-r-size-4')).toBe(true);
});
