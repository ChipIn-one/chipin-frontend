import type { ComponentProps, ReactNode } from 'react';

import { RadioGroup as RadixRadioGroup } from '@radix-ui/themes';

interface RadioGroupItem {
    value: string;
    label: ReactNode;
    isDisabled?: boolean;
}

interface Props extends Omit<ComponentProps<typeof RadixRadioGroup.Root>, 'children'> {
    items: RadioGroupItem[];
}

const RadioGroup = ({ items, ...rootProps }: Props) => (
    <RadixRadioGroup.Root {...rootProps}>
        {items.map(item => (
            <RadixRadioGroup.Item
                key={item.value}
                value={item.value}
                disabled={item.isDisabled}
            >
                {item.label}
            </RadixRadioGroup.Item>
        ))}
    </RadixRadioGroup.Root>
);

export { RadioGroup, type RadioGroupItem };
