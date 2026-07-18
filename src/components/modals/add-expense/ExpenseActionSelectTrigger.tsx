import { ComponentPropsWithoutRef, ElementRef, forwardRef } from 'react';
import { LucideChevronDown } from 'lucide-react';
import styled from 'styled-components';

import { Button, Flex, Text } from '@radix-ui/themes';

interface Props extends Omit<ComponentPropsWithoutRef<typeof Button>, 'children' | 'value'> {
    icon?: React.ReactNode;
    title: string;
    value: string;
    isLoading?: boolean;
}

const TriggerButton = styled(Button)`
    width: 100%;
    min-width: 0;
    height: 52px;
    justify-content: stretch;

    & > span {
        min-width: 0;
        width: 100%;
    }
`;

const ExpenseActionSelectTrigger = forwardRef<ElementRef<typeof Button>, Props>(
    ({ icon, title, value, isLoading = false, ...triggerProps }, ref) => {
        return (
            <TriggerButton
                {...triggerProps}
                ref={ref}
                type="button"
                variant="surface"
                color="gray"
                size="3"
                radius="large"
                loading={isLoading}
            >
                <Flex align="center" gap="3" width="100%" minWidth="0">
                    {icon}

                    <Flex direction="column" align="start" minWidth="0" flexGrow="1">
                        <Text as="span" size="2" weight="medium" color="gray" truncate>
                            {title}
                        </Text>
                        <Text as="span" size="3" weight="medium" truncate>
                            {value}
                        </Text>
                    </Flex>

                    <LucideChevronDown size={18} />
                </Flex>
            </TriggerButton>
        );
    },
);

ExpenseActionSelectTrigger.displayName = 'ExpenseActionSelectTrigger';

export default ExpenseActionSelectTrigger;
