import {
    type ComponentPropsWithoutRef,
    type ComponentRef,
    forwardRef,
    type ReactNode,
} from 'react';
import { LucideChevronDown } from 'lucide-react';

import { Button, Flex, Text } from '@radix-ui/themes';

import { TriggerButton } from './styled';

interface Props extends Omit<ComponentPropsWithoutRef<typeof Button>, 'children' | 'value'> {
    icon?: ReactNode;
    title: string;
    value: string;
    isLoading?: boolean;
}

const ExpenseSearchSelectContent = forwardRef<ComponentRef<typeof Button>, Props>(
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
                        <Text as="span" size="3" weight="bold" truncate>
                            {value}
                        </Text>
                    </Flex>

                    <LucideChevronDown size={18} />
                </Flex>
            </TriggerButton>
        );
    },
);

ExpenseSearchSelectContent.displayName = 'ExpenseSearchSelectContent';

export default ExpenseSearchSelectContent;
