import {
    LucideArrowLeftRight,
    LucideCalculator,
    LucideGlobe,
    LucideUsers,
    LucideZap,
} from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, Box, Card, Container, Flex, Grid, Heading, Section, Text } from '@radix-ui/themes';

type AvatarColor = ComponentPropsWithoutRef<typeof Avatar>['color'];

interface Feature {
    title: string;
    description: string;
    icon: ReactElement;
    color: AvatarColor;
}

const FeaturesSection = () => {
    const { t } = useTranslation('landing');

    const features: Feature[] = [
        {
            title: t('features.smartGroups.title'),
            description: t('features.smartGroups.description'),
            icon: <LucideUsers />,
            color: 'green',
        },
        {
            title: t('features.quickExpense.title'),
            description: t('features.quickExpense.description'),
            icon: <LucideZap />,
            color: 'blue',
        },
        {
            title: t('features.autoCalc.title'),
            description: t('features.autoCalc.description'),
            icon: <LucideCalculator />,
            color: 'violet',
        },
        {
            title: t('features.multiCurrency.title'),
            description: t('features.multiCurrency.description'),
            icon: <LucideGlobe />,
            color: 'cyan',
        },
        {
            title: t('features.settleUp.title'),
            description: t('features.settleUp.description'),
            icon: <LucideArrowLeftRight />,
            color: 'crimson',
        },
    ];

    return (
        <Section id="features" py="8">
            <Container size="4">
                <Flex direction="column" align="center" gap="3" mb="8">
                    <Text size={{ initial: '2', md: '3' }} color="green" weight="medium">
                        {t('features.eyebrow')}
                    </Text>
                    <Heading align="center" size={{ initial: '7', md: '8' }}>
                        {t('features.titlePart1')}{' '}
                        <Text as="span" color="green">
                            {t('features.titleHighlight')}
                        </Text>{' '}
                        {t('features.titlePart2')}
                    </Heading>
                    <Box maxWidth="580px">
                        <Text align="center" as="p" color="gray" size={{ initial: '3', sm: '4' }}>
                            {t('features.subtitle')}
                        </Text>
                    </Box>
                </Flex>

                <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="4">
                    {features.map(({ title, description, icon, color }) => (
                        <Card key={title} size="3">
                            <Flex direction="column" gap="3">
                                <Flex align="center" gap="3">
                                    <Avatar size="3" color={color} variant="soft" fallback={icon} />
                                    <Heading size="4">{title}</Heading>
                                </Flex>
                                <Text size="3" color="gray">
                                    {description}
                                </Text>
                            </Flex>
                        </Card>
                    ))}
                </Grid>
            </Container>
        </Section>
    );
};

export default FeaturesSection;
