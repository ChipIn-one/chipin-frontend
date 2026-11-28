import {
    type ComponentPropsWithoutRef,
    type ComponentRef,
    forwardRef,
    type ReactNode,
} from 'react';
import { PROP_COLOR } from '@chipin/tokens/theme';
import { Button, Flex, Text } from '@radix-ui/themes';
import { ChevronDownIcon } from 'lucide-react';

import { cx } from 'helpers/cx';

import styles from './ExpenseSearchSelectContent.module.css';

interface Props extends Omit<ComponentPropsWithoutRef<typeof Button>, 'children' | 'value'> {
    icon?: ReactNode;
    title: string;
    value: string;
    isLoading?: boolean;
}

const ExpenseSearchSelectContent = forwardRef<ComponentRef<typeof Button>, Props>(
    ({ icon, title, value, isLoading = false, className, ...triggerProps }, ref) => {
        return (
            <Button
                {...triggerProps}
                ref={ref}
                className={cx(styles.root, className)}
                type="button"
                variant="surface"
                color={PROP_COLOR.neutral}
                size="3"
                radius="large"
                loading={isLoading}
            >
                <Flex align="center" gap="3" width="100%" minWidth="0">
                    {icon}

                    <Flex direction="column" align="start" minWidth="0" flexGrow="1">
                        <Text
                            as="span"
                            size="2"
                            weight="medium"
                            color={PROP_COLOR.neutral}
                            truncate
                        >
                            {title}
                        </Text>
                        <Text as="span" size="3" weight="bold" truncate>
                            {value}
                        </Text>
                    </Flex>

                    <ChevronDownIcon size={18} />
                </Flex>
            </Button>
        );
    },
);

ExpenseSearchSelectContent.displayName = 'ExpenseSearchSelectContent';

export { ExpenseSearchSelectContent };
