import { LucideInfo } from 'lucide-react';
import { expect, test } from 'vitest';

import { Button, Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';

import EmptyState from './EmptyState';

const TITLE = 'Empty title';
const DESCRIPTION = 'Empty description';
const ACTION_LABEL = 'Action';

test('uses the compact GroupCard-aligned visual contract', () => {
    render(
        <Theme>
            <EmptyState
                icon={<LucideInfo size={20} />}
                title={TITLE}
                description={DESCRIPTION}
                action={<Button>{ACTION_LABEL}</Button>}
            />
        </Theme>,
    );

    const title = screen.getByText(TITLE);
    const description = screen.getByText(DESCRIPTION);
    const card = title.closest('[data-empty-state]');
    const avatar = card?.querySelector('.rt-AvatarRoot');

    expect(card).toBeTruthy();
    expect(card?.className).toContain('rt-r-size-1');
    expect(avatar?.className).toContain('rt-r-size-4');
    expect(title.className).toContain('rt-r-size-3');
    expect(title.className).toContain('rt-r-weight-bold');
    expect(description.className).toContain('rt-r-size-1');
    expect(
        screen.getByRole('button', { name: ACTION_LABEL }),
    ).toBeTruthy();
});

test('stacks the optional action under the icon and description', () => {
    render(
        <Theme>
            <EmptyState
                icon={<LucideInfo size={20} />}
                title={TITLE}
                description={DESCRIPTION}
                action={<Button>{ACTION_LABEL}</Button>}
                actionPosition="below"
            />
        </Theme>,
    );

    const card = screen.getByText(TITLE).closest('[data-empty-state]');
    const layout = card?.firstElementChild;
    const action = screen.getByRole('button', { name: ACTION_LABEL });
    const actionContainer = card?.querySelector('[data-empty-state-action]');

    expect(layout?.className).toContain('rt-r-fd-column');
    expect(layout?.lastElementChild).toBe(actionContainer);
    expect(actionContainer?.contains(action)).toBe(true);
    expect(layout?.className).toContain('rt-r-ai-stretch');
});
