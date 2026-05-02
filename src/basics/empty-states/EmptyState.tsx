import { ComponentProps, ReactNode } from 'react';

import { Avatar, Box, Card, Flex, Text } from '@radix-ui/themes';

interface Props {
    icon: NonNullable<ReactNode>;
    iconColor?: ComponentProps<typeof Avatar>['color'];
    title: string;
    description?: string;
    action?: ReactNode;
}

const EmptyState = ({ icon, iconColor = 'gray', title, description, action }: Props) => {
    return (
        <Card size="2">
            <Flex direction="column" gap="3">
                <Flex align="center" gap="3">
                    <Avatar size="3" color={iconColor} variant="soft" fallback={icon} />

                    <Flex gap="3" justify="between" align="center" flexGrow="1">
                        <Flex direction="column" gap="1" flexGrow="1">
                            <Text size="3" weight="medium" as="p">
                                {title}
                            </Text>

                            {description && (
                                <Text size="2" color="gray" as="p">
                                    {description}
                                </Text>
                            )}
                        </Flex>
                        {action && <Box flexShrink="0">{action}</Box>}
                    </Flex>
                </Flex>
            </Flex>
        </Card>
    );
};

export default EmptyState;
