import { ReactNode } from 'react';

import { Flex, Select as RadixSelect } from '@radix-ui/themes';

type RadixSelectRootProps = React.ComponentProps<typeof RadixSelect.Root>;
type RadixSelectTriggerProps = React.ComponentProps<typeof RadixSelect.Trigger>;
type RadixSelectContentProps = React.ComponentProps<typeof RadixSelect.Content>;

export interface SelectItem {
    value: string;
    label: ReactNode;
    isDisabled?: boolean;
}

interface RenderItemContext {
    isSelected: boolean;
}

interface Props {
    items: SelectItem[];
    value: string;
    onChange: (value: string) => void;
    size?: RadixSelectRootProps['size'];
    placeholder?: string;
    triggerVariant?: RadixSelectTriggerProps['variant'];
    triggerColor?: RadixSelectTriggerProps['color'];
    triggerRadius?: RadixSelectTriggerProps['radius'];
    contentVariant?: RadixSelectContentProps['variant'];
    contentColor?: RadixSelectContentProps['color'];
    isContentHighContrast?: RadixSelectContentProps['highContrast'];
    renderValue?: (item: SelectItem | undefined) => ReactNode;
    renderItem?: (item: SelectItem, context: RenderItemContext) => ReactNode;
}

const Select = ({
    items,
    value,
    onChange,
    size = '2',
    placeholder,
    triggerVariant,
    triggerColor,
    triggerRadius,
    contentVariant,
    contentColor,
    isContentHighContrast,
    renderValue,
    renderItem,
}: Props) => {
    const selectedItem = items.find(item => item.value === value);

    return (
        <RadixSelect.Root size={size} value={value} onValueChange={onChange}>
            <RadixSelect.Trigger
                placeholder={placeholder}
                variant={triggerVariant}
                color={triggerColor}
                radius={triggerRadius}
            >
                {renderValue ? renderValue(selectedItem) : selectedItem?.label}
            </RadixSelect.Trigger>

            <RadixSelect.Content
                variant={contentVariant}
                color={contentColor}
                highContrast={isContentHighContrast}
            >
                {items.map(item => {
                    const isSelectedItem = item.value === value;
                    const itemContent = renderItem
                        ? renderItem(item, { isSelected: isSelectedItem })
                        : item.label;

                    return (
                        <RadixSelect.Item
                            key={item.value}
                            value={item.value}
                            disabled={item.isDisabled}
                        >
                            <Flex align="center" gap="2" minWidth="0">
                                {itemContent}
                            </Flex>
                        </RadixSelect.Item>
                    );
                })}
            </RadixSelect.Content>
        </RadixSelect.Root>
    );
};

export default Select;
