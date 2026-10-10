import { ComponentProps, ReactNode } from 'react';

import { Avatar, Box, Card, Flex, Text } from '@radix-ui/themes';

interface Props {
    icon: NonNullable<ReactNode>;
    iconColor?: ComponentProps<typeof Avatar>['color'];
    title: string;
    description?: string;
    action?: ReactNode;
    actionPosition?: 'inline' | 'below';
}

const EmptyState = ({
    icon,
    iconColor = 'gray',
    title,
    description,
    action,
    actionPosition = 'inline',
}: Props) => {
    const isActionBelow = actionPosition === 'below';

    return (
        <Card size="1" data-empty-state>
            <Flex
                direction={isActionBelow ? 'column' : 'row'}
                align={isActionBelow ? 'stretch' : 'center'}
                gap="3"
                width="100%"
                minWidth="0"
            >
                <Flex align="center" gap="3" flexGrow="1" minWidth="0">
                    <Avatar
                        size="4"
                        color={iconColor}
                        variant="soft"
                        fallback={icon}
                    />

                    <Flex
                        direction="column"
                        gap="1"
                        flexGrow="1"
                        flexShrink="1"
                        minWidth="0"
                    >
                        <Text size="3" weight="bold" as="p">
                            {title}
                        </Text>

                        {description && (
                            <Text size="1" color="gray" as="p">
                                {description}
                            </Text>
                        )}
                    </Flex>
                </Flex>

                {action && (
                    <Box
                        width={isActionBelow ? '100%' : undefined}
                        flexShrink={isActionBelow ? undefined : '0'}
                        data-empty-state-action
                    >
                        {action}
                    </Box>
                )}
            </Flex>
        </Card>
    );
};

export default EmptyState;
