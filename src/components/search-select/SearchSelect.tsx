import { useEffect, useMemo, useState } from 'react';
import { LucideSearch } from 'lucide-react';
import styled from 'styled-components';

import { Box, Button, Flex, Popover, ScrollArea, Text, TextField } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';
import { getFilterFunction } from 'helpers/text';

export interface SearchSelectItem {
    value: string;
    label: string;
    icon?: React.ReactNode;
    isIndented?: boolean;
    searchFields?: string[];
}

interface Props {
    items: SearchSelectItem[];
    value?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    triggerElement: React.ReactElement;
    contentWidthMode?: 'trigger' | 'parent';
    widthContainerRef?: React.RefObject<HTMLElement | null>;
    onChange?: (value: string) => void;
}

const OptionsScrollArea = styled(ScrollArea)`
    height: 240px;
    border: 1px solid ${themeColor('grayA7')};
    border-radius: var(--radius-3);
    background-color: ${themeColor('grayA2')};
    box-sizing: border-box;

    & [data-radix-scroll-area-viewport] > div {
        min-width: 0;
        width: 100%;
    }
`;

const SearchSelect = ({
    items,
    value,
    searchPlaceholder = '',
    emptyText = '',
    triggerElement,
    contentWidthMode = 'trigger',
    widthContainerRef,
    onChange,
}: Props) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [contentWidth, setContentWidth] = useState<number | null>(null);

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

    const isParentWidthMode = contentWidthMode === 'parent';

    useEffect(() => {
        if (!isParentWidthMode || !widthContainerRef?.current) {
            return;
        }

        const widthContainerElement = widthContainerRef.current;

        const updateContentWidth = () => {
            setContentWidth(widthContainerElement.getBoundingClientRect().width);
        };

        updateContentWidth();

        const resizeObserver = new ResizeObserver(() => {
            updateContentWidth();
        });

        resizeObserver.observe(widthContainerElement);

        return () => {
            resizeObserver.disconnect();
        };
    }, [isParentWidthMode, widthContainerRef]);

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

    const popoverWidth =
        isParentWidthMode && contentWidth !== null
            ? `${contentWidth}px`
            : 'var(--radix-popover-trigger-width)';

    return (
        <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
            <Popover.Trigger>{triggerElement}</Popover.Trigger>

            <Popover.Content align="end" sideOffset={4} width={popoverWidth}>
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
                                        <Button
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
                                        </Button>
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

export default SearchSelect;
