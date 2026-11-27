// #950: the page loader shows an optional line under the spinner (e.g. "Signing you in…").
import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { PageLoader } from './PageLoader';

const LINE = 'Loading line';

test('#950: PageLoader renders its children under the loader', () => {
    render(
        <PageLoader>
            <span role="status">{LINE}</span>
        </PageLoader>,
        { wrapper: Theme },
    );

    expect(screen.getByRole('status').textContent).toBe(LINE);
});
