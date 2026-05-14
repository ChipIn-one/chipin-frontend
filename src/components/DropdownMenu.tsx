import { ReactNode, useState } from 'react';

import { DropdownMenu } from '@radix-ui/themes';

type ContentProps = React.ComponentProps<typeof DropdownMenu.Content>;

export interface DropdownMenuItem {
    value: string;
    label: ReactNode;
    icon?: ReactNode;
    onSelect?: () => void;
    isDisabled?: boolean;
}

interface Props {
    items: DropdownMenuItem[];
    trigger: ReactNode;
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    side?: ContentProps['side'];
    align?: ContentProps['align'];
}

const Dropdown = ({ items, trigger, value, defaultValue, onValueChange, side, align }: Props) => {
    const [internalValue, setInternalValue] = useState(defaultValue ?? '');

    const isSelectable =
        value !== undefined || defaultValue !== undefined || onValueChange !== undefined;

    const activeValue = value ?? internalValue;

    const handleValueChange = (next: string) => {
        setInternalValue(next);
        onValueChange?.(next);
    };

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger>{trigger}</DropdownMenu.Trigger>
            <DropdownMenu.Content side={side} align={align}>
                {isSelectable ? (
                    <DropdownMenu.RadioGroup value={activeValue} onValueChange={handleValueChange}>
                        {items.map(item => (
                            <DropdownMenu.RadioItem
                                key={item.value}
                                value={item.value}
                                disabled={item.isDisabled}
                                onSelect={item.onSelect}
                            >
                                {item.icon}
                                {item.label}
                            </DropdownMenu.RadioItem>
                        ))}
                    </DropdownMenu.RadioGroup>
                ) : (
                    items.map(item => (
                        <DropdownMenu.Item
                            key={item.value}
                            disabled={item.isDisabled}
                            onSelect={item.onSelect}
                        >
                            {item.icon}
                            {item.label}
                        </DropdownMenu.Item>
                    ))
                )}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
};

export default Dropdown;
