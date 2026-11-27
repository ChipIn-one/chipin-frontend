import { SegmentedControl as RadixSegmentedControl } from '@radix-ui/themes';
import type { ComponentProps, ReactNode } from 'react';

import styles from './SegmentedControl.module.css';

export interface SegmentedControlItem {
    value: string;
    label: ReactNode;
}

interface Props extends ComponentProps<typeof RadixSegmentedControl.Root> {
    items: SegmentedControlItem[];
    /** Take the container's width and shrink with it (equal-width cells, compact padding). */
    fill?: boolean;
}

const SegmentedControl = ({
    items,
    size = { initial: '2', sm: '3' },
    fill = false,
    className,
    ...rootProps
}: Props) => {
    const rootClassName = fill ? [styles.fill, className].filter(Boolean).join(' ') : className;

    return (
        <RadixSegmentedControl.Root {...rootProps} className={rootClassName} size={size}>
            {items.map(item => (
                <RadixSegmentedControl.Item key={item.value} value={item.value}>
                    {item.label}
                </RadixSegmentedControl.Item>
            ))}
        </RadixSegmentedControl.Root>
    );
};

export { SegmentedControl };
