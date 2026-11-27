import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { SegmentedControl } from './SegmentedControl';

const items = [
    { value: 'a', label: 'First' },
    { value: 'b', label: 'Second' },
];

const renderRoot = (size?: '1' | '2' | '3') => {
    render(<SegmentedControl items={items} defaultValue="a" size={size} />, { wrapper: Theme });

    const root = screen.getByRole('radio', { name: 'First' }).closest('.rt-SegmentedControlRoot');
    if (!(root instanceof HTMLElement)) {
        throw new Error('SegmentedControl root not found');
    }
    return root;
};

test('defaults to size 2 on mobile and 3 from the sm breakpoint', () => {
    const root = renderRoot();

    expect(root.classList).toContain('rt-r-size-2');
    expect(root.classList).toContain('sm:rt-r-size-3');
});

test.each(['1', '2', '3'] as const)('passes an explicit size %s to the root', size => {
    const root = renderRoot(size);

    expect(root.classList).toContain(`rt-r-size-${size}`);
    expect([...root.classList].some(name => name.startsWith('sm:'))).toBe(false);
});
