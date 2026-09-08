import type { ComponentProps, ReactNode } from 'react';

import { Flex, RadioCards as RadixRadioCards } from '@radix-ui/themes';

import { RadioMarker } from './styled';

interface RadioCardsItem {
    value: string;
    label: ReactNode;
    isDisabled?: boolean;
}

interface Props extends Omit<ComponentProps<typeof RadixRadioCards.Root>, 'children'> {
    items: RadioCardsItem[];
}

const RadioCards = ({ items, ...rootProps }: Props) => (
    <RadixRadioCards.Root {...rootProps}>
        {items.map(item => (
            <RadixRadioCards.Item
                key={item.value}
                value={item.value}
                disabled={item.isDisabled}
            >
                <Flex align="center" gap="2">
                    <RadioMarker aria-hidden="true" />
                    {item.label}
                </Flex>
            </RadixRadioCards.Item>
        ))}
    </RadixRadioCards.Root>
);

export { RadioCards, type RadioCardsItem };
