import { ComponentProps, ReactNode } from 'react';

import { Avatar, Box, Card, Flex, Text } from '@radix-ui/themes';

interface Props {
    icon: NonNullable<ReactNode>;
    iconColor?: ComponentProps<typeof Avatar>['color'];
    title: string;
    description?: string;
    action?: ReactNode;
}

const EmptyState = ({
    icon,
    iconColor = 'gray',
    title,
    description,
    action,
}: Props) => {
    return (
        <Card size="1" data-empty-state>
            <Flex align="center" gap="3" width="100%" minWidth="0">
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

                {action && <Box flexShrink="0">{action}</Box>}
            </Flex>
        </Card>
    );
};

export default EmptyState;
