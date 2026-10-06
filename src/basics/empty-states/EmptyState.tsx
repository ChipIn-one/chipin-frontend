import { ComponentProps, ReactNode } from 'react';

import { Avatar, Box, Card, Flex, Text } from '@radix-ui/themes';

type EmptyStateDensity = 'default' | 'groupCard';

interface Props {
    icon: NonNullable<ReactNode>;
    iconColor?: ComponentProps<typeof Avatar>['color'];
    title: string;
    description?: string;
    action?: ReactNode;
    density?: EmptyStateDensity;
}

const EmptyState = ({
    icon,
    iconColor = 'gray',
    title,
    description,
    action,
    density = 'default',
}: Props) => {
    const isGroupCardDensity = density === 'groupCard';

    return (
        <Card
            size={isGroupCardDensity ? '1' : '2'}
            data-empty-state-density={density}
        >
            <Flex
                direction={isGroupCardDensity ? 'row' : 'column'}
                align={isGroupCardDensity ? 'center' : undefined}
                gap="3"
            >
                <Flex align="center" gap="3" minWidth="0" flexGrow="1">
                    <Avatar
                        size={isGroupCardDensity ? '4' : '3'}
                        color={iconColor}
                        variant="soft"
                        fallback={icon}
                    />

                    <Flex
                        gap="3"
                        justify="between"
                        align="center"
                        flexGrow="1"
                        minWidth="0"
                    >
                        <Flex
                            direction="column"
                            gap="1"
                            flexGrow="1"
                            minWidth="0"
                        >
                            <Text
                                size="3"
                                weight={isGroupCardDensity ? 'bold' : 'medium'}
                                as="p"
                            >
                                {title}
                            </Text>

                            {description && (
                                <Text
                                    size={isGroupCardDensity ? '1' : '2'}
                                    color="gray"
                                    as="p"
                                >
                                    {description}
                                </Text>
                            )}
                        </Flex>

                        {isGroupCardDensity && action && (
                            <Box flexShrink="0">
                                {action}
                            </Box>
                        )}
                    </Flex>
                </Flex>

                {!isGroupCardDensity && action && (
                    <Box flexShrink="0" ml="8">
                        {action}
                    </Box>
                )}
            </Flex>
        </Card>
    );
};

export default EmptyState;
