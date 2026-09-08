import { useMemo, useState } from 'react';
import { LucideSearch } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Box, Flex, Popover, Text, TextField } from '@radix-ui/themes';

import { getFilterFunction } from 'helpers/text';

import { OptionButton, OptionsScrollArea } from './styled';
import type { SearchSelectItem } from './types';

type BoxProps = ComponentProps<typeof Box>;
type PopoverContentProps = ComponentProps<typeof Popover.Content>;

interface SearchSelectProps {
    items: SearchSelectItem[];
    value?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    triggerElement: React.ReactElement;
    triggerWidth?: 'content' | 'full' | NonNullable<BoxProps['width']>;
    contentWidth?: 'content' | 'trigger' | NonNullable<PopoverContentProps['width']>;
    contentMinWidth?: PopoverContentProps['minWidth'];
    contentMaxWidth?: PopoverContentProps['maxWidth'];
    onChange?: (value: string) => void;
}

const resolveTriggerWidth = (triggerWidth: SearchSelectProps['triggerWidth']) => {
    if (triggerWidth === 'content') {
        return undefined;
    }

    return triggerWidth === 'full' ? '100%' : triggerWidth;
};

const resolveContentWidth = (contentWidth: SearchSelectProps['contentWidth']) => {
    if (contentWidth === 'trigger') {
        return 'var(--radix-popover-trigger-width)';
    }

    return contentWidth === 'content' ? 'max-content' : contentWidth;
};

const SearchSelect = ({
    items,
    value,
    searchPlaceholder = '',
    emptyText = '',
    triggerElement,
    triggerWidth = 'full',
    contentWidth = 'trigger',
    contentMinWidth,
    contentMaxWidth,
    onChange,
}: SearchSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchValue, setSearchValue] = useState('');

    const filteredItems = useMemo(() => {
        const filterFunction = getFilterFunction(searchValue);

        if (!filterFunction) {
            return items;
        }

        return items.filter(item => {
            const fields = item.searchFields ?? [item.label, item.value];

            return filterFunction(fields);
        });
    }, [items, searchValue]);

    const onValueChange = (nextValue: string) => {
        onChange?.(nextValue);
        setIsOpen(false);
        setSearchValue('');
    };

    const onOpenChange = (nextOpen: boolean) => {
        setIsOpen(nextOpen);

        if (!nextOpen) {
            setSearchValue('');
        }
    };

    const resolvedTriggerWidth = resolveTriggerWidth(triggerWidth);
    const resolvedContentWidth = resolveContentWidth(contentWidth);
    const resolvedContentMinWidth =
        contentMinWidth ?? (contentWidth === 'trigger' ? undefined : '0');

    return (
        <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
            <Popover.Trigger>
                <Box asChild width={resolvedTriggerWidth} minWidth="0">
                    {triggerElement}
                </Box>
            </Popover.Trigger>

            <Popover.Content
                align="end"
                sideOffset={4}
                width={resolvedContentWidth}
                minWidth={resolvedContentMinWidth}
                maxWidth={contentMaxWidth}
            >
                <Flex direction="column" gap="2">
                    <TextField.Root
                        autoFocus
                        size="3"
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onChange={event => setSearchValue(event.target.value)}
                        aria-label={searchPlaceholder}
                    >
                        <TextField.Slot side="left">
                            <LucideSearch size={16} />
                        </TextField.Slot>
                    </TextField.Root>

                    <OptionsScrollArea type="always" scrollbars="vertical">
                        <Flex direction="column" gap="2" pr="4">
                            {filteredItems.length > 0 ? (
                                filteredItems.map(item => {
                                    const isSelected = item.value === value;

                                    return (
                                        <OptionButton
                                            key={item.value}
                                            type="button"
                                            size="3"
                                            variant="soft"
                                            color={isSelected ? 'blue' : 'gray'}
                                            highContrast={isSelected}
                                            onClick={() => onValueChange(item.value)}
                                        >
                                            <Flex
                                                align="center"
                                                gap="2"
                                                width="100%"
                                                minWidth="0"
                                                pl={item.isIndented ? '4' : undefined}
                                            >
                                                {item.icon}
                                                <Text as="span" size="2" truncate>
                                                    {item.label}
                                                </Text>
                                            </Flex>
                                        </OptionButton>
                                    );
                                })
                            ) : (
                                <Box px="2" py="3">
                                    <Text size="2" color="gray">
                                        {emptyText}
                                    </Text>
                                </Box>
                            )}
                        </Flex>
                    </OptionsScrollArea>
                </Flex>
            </Popover.Content>
        </Popover.Root>
    );
};

export { SearchSelect, type SearchSelectProps };
