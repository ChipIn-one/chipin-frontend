import { LucideCheckCircle } from 'lucide-react';
import type { ReactElement } from 'react';

import { Badge, Box, Flex, Grid, Heading, Text } from '@radix-ui/themes';

interface Bullet {
    key: string;
    text: string;
}

interface Props {
    badge: string;
    badgeIcon: ReactElement;
    bullets: Bullet[];
    color: 'green' | 'violet';
    description: string;
    isMediaFirst?: boolean;
    media: ReactElement;
    title: string;
    titleHighlight: string;
}

const ShowcaseSection = ({
    badge,
    badgeIcon,
    bullets,
    color,
    description,
    isMediaFirst = false,
    media,
    title,
    titleHighlight,
}: Props) => {
    const content = (
        <Flex direction="column" gap="4">
            <Box width="max-content">
                <Badge color={color} variant="surface" radius="full" size="3">
                    {badgeIcon}
                    {badge}
                </Badge>
            </Box>

            <Heading size={{ initial: '7', md: '9' }}>
                {title}{' '}
                <Text as="span" color={color}>
                    {titleHighlight}
                </Text>
            </Heading>

            <Text size="4" color="gray">
                {description}
            </Text>

            <Flex direction="column" gap="3">
                {bullets.map(bullet => (
                    <Flex key={bullet.key} align="center" gap="3">
                        <Text as="span" color={color}>
                            <LucideCheckCircle size={18} />
                        </Text>
                        <Text size="3">{bullet.text}</Text>
                    </Flex>
                ))}
            </Flex>
        </Flex>
    );
    if (!isMediaFirst) {
        return (
            <Grid columns={{ initial: '1', md: '2' }} gap="9" align="center">
                {content}
                {media}
            </Grid>
        );
    }

    return (
        <Grid columns={{ initial: '1', md: '2' }} gap="9" align="center">
            <Box
                gridColumn={{ initial: '1', md: '2' }}
                gridRow={{ initial: '1', md: '1' }}
            >
                {content}
            </Box>
            <Box
                gridColumn={{ initial: '1', md: '1' }}
                gridRow={{ initial: '2', md: '1' }}
            >
                {media}
            </Box>
        </Grid>
    );
};

export default ShowcaseSection;
