import { ComponentProps, ReactNode } from 'react';

import { SegmentedControl as RadixSegmentedControl } from '@radix-ui/themes';

export interface SegmentedControlItem {
    value: string;
    label: ReactNode;
}

interface Props extends ComponentProps<typeof RadixSegmentedControl.Root> {
    items: SegmentedControlItem[];
}

const SegmentedControl = ({ items, ...rootProps }: Props) => {
    return (
        <RadixSegmentedControl.Root {...rootProps} size={{ initial: '2', sm: '3' }}>
            {items.map(item => (
                <RadixSegmentedControl.Item key={item.value} value={item.value}>
                    {item.label}
                </RadixSegmentedControl.Item>
            ))}
        </RadixSegmentedControl.Root>
    );
};

export default SegmentedControl;
