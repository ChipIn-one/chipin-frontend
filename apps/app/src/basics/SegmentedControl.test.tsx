import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { SegmentedControl } from './SegmentedControl';

import styles from './SegmentedControl.module.css';

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

const rootOf = (name: string) => {
    const root = screen.getByRole('radio', { name }).closest('.rt-SegmentedControlRoot');
    if (!(root instanceof HTMLElement)) {
        throw new Error('SegmentedControl root not found');
    }
    return root;
};

test('#969: fill adds the fill class and keeps the caller className', () => {
    render(<SegmentedControl items={items} defaultValue="a" fill className="caller" />, {
        wrapper: Theme,
    });

    const root = rootOf('First');
    expect(root.classList).toContain(styles.fill);
    expect(root.classList).toContain('caller');
});

test('#969: without fill the root has no fill class and keeps the caller className', () => {
    render(<SegmentedControl items={items} defaultValue="a" className="caller" />, {
        wrapper: Theme,
    });

    const root = rootOf('First');
    expect(styles.fill).toBeTruthy();
    expect(root.classList).not.toContain(styles.fill);
    expect(root.classList).toContain('caller');
});
