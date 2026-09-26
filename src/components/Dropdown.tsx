import { ReactNode, useState } from 'react';

import { DropdownMenu } from '@radix-ui/themes';

type ContentProps = React.ComponentProps<typeof DropdownMenu.Content>;
type ItemColor = React.ComponentProps<typeof DropdownMenu.Item>['color'];

export interface DropdownMenuItem {
    value: string;
    label: ReactNode;
    icon?: ReactNode;
    onSelect?: () => void;
    isDisabled?: boolean;
    color?: ItemColor;
}

export interface DropdownMenuSection {
    label?: ReactNode;
    items: DropdownMenuItem[];
}

interface Props {
    items?: DropdownMenuItem[];
    sections?: DropdownMenuSection[];
    trigger: ReactNode;
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    side?: ContentProps['side'];
    align?: ContentProps['align'];
}

const Dropdown = ({
    items,
    sections,
    trigger,
    value,
    defaultValue,
    onValueChange,
    side,
    align,
}: Props) => {
    const [internalValue, setInternalValue] = useState(defaultValue ?? '');

    const isSelectable =
        value !== undefined || defaultValue !== undefined || onValueChange !== undefined;

    const activeValue = value ?? internalValue;

    const handleSelect = (itemValue: string) => {
        setInternalValue(itemValue);
        onValueChange?.(itemValue);
    };

    const renderItem = (item: DropdownMenuItem) => {
        const isActive = isSelectable && activeValue === item.value;

        return (
            <DropdownMenu.Item
                key={item.value}
                disabled={item.isDisabled}
                color={isActive ? 'green' : item.color}
                onSelect={() => {
                    item.onSelect?.();
                    if (isSelectable) {
                        handleSelect(item.value);
                    }
                }}
            >
                {item.icon}
                {item.label}
            </DropdownMenu.Item>
        );
    };

    const renderContent = () => {
        if (sections) {
            return sections.flatMap((section, index) => {
                const nodes: ReactNode[] = [];
                if (index > 0) {
                    nodes.push(<DropdownMenu.Separator key={`sep-${index}`} />);
                }
                if (section.label) {
                    nodes.push(
                        <DropdownMenu.Label key={`label-${index}`}>
                            {section.label}
                        </DropdownMenu.Label>,
                    );
                }
                section.items.forEach(item => nodes.push(renderItem(item)));
                return nodes;
            });
        }

        return items?.map(item => renderItem(item));
    };

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger>{trigger}</DropdownMenu.Trigger>
            <DropdownMenu.Content side={side} align={align}>
                {renderContent()}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
};

export default Dropdown;
