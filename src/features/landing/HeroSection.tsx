import {
    LucideArrowRight,
    LucideDownload,
    LucideReceipt,
    LucideStar,
    LucideUserCheck,
    LucideUsers2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge, Box, Button, Container, Flex, Heading, Section, Text } from '@radix-ui/themes';

import { usePwaStore } from 'store/pwaStore';

import { Amount } from 'basics/numbers';
import { AuthModal } from 'components/modals';

const HeroSection = () => {
    const isPwaInstalled = usePwaStore(s => s.isPwaInstalled);
    const isPwaInstallable = usePwaStore(s => s.isPwaInstallable);
    const { callPWAInstall } = usePwaStore();
    const { t } = useTranslation('landing');

    const stats = [
        {
            title: <Amount value={50000} tokenCode="+" />,
            description: t('stats.activeUsers'),
            icon: <LucideUserCheck />,
        },
        {
            title: <Amount type="summary" value={25300000} />,
            description: t('stats.expensesTracked'),
            icon: <LucideReceipt />,
        },
        {
            title: <Amount value={15000} tokenCode="+" />,
            description: t('stats.groupsCreated'),
            icon: <LucideUsers2 />,
        },
        {
            title: <Amount value={4.9} />,
            description: t('stats.userRating'),
            icon: <LucideStar />,
        },
    ];

    return (
        <Section>
            <Container size="3">
                <Flex direction="column" align="center" gap="5">
                    <Badge
                        size={{ initial: '1', sm: '2' }}
                        color="green"
                        variant="surface"
                        radius="full"
                    >
                        {t('badge')}
                    </Badge>

                    <Heading size={{ initial: '8', md: '9' }} align="center">
                        {t('heroTitle')}{' '}
                        <Text
                            as="span"
                            size={{ initial: '8', md: '9' }}
                            color="green"
                            weight="bold"
                        >
                            {t('heroTitleHighlight')}
                        </Text>
                    </Heading>

                    <Box maxWidth="560px">
                        <Text
                            align="center"
                            color="gray"
                            as="p"
                            size={{ initial: '3', sm: '4', md: '5' }}
                        >
                            {t('heroDescription')}
                        </Text>
                    </Box>

                    <Flex gap="3" wrap="wrap" justify="center" pt="2">
                        <AuthModal>
                            <Button size={{ initial: '3', sm: '4' }} variant="solid" color="green">
                                {t('common:buttons.getStarted')}
                                <LucideArrowRight />
                            </Button>
                        </AuthModal>

                        {!isPwaInstalled && isPwaInstallable && (
                            <Button
                                size={{ initial: '3', sm: '4' }}
                                variant="soft"
                                color="gray"
                                onClick={callPWAInstall}
                            >
                                {t('common:buttons.installApp')}
                                <LucideDownload />
                            </Button>
                        )}
                    </Flex>

                    <Flex wrap="wrap" gap="6" justify="center" pt="4" width="100%">
                        {stats.map(({ title, description, icon }, index) => (
                            <Flex
                                key={index}
                                direction="column"
                                align="center"
                                gap="1"
                                minWidth="120px"
                                flexGrow="1"
                                flexShrink="1"
                                flexBasis="0"
                            >
                                <Text size="5" weight="bold" color="green">
                                    <Flex align="center" gap="1">
                                        {icon}
                                        {title}
                                    </Flex>
                                </Text>
                                <Text size="2" color="gray">
                                    {description}
                                </Text>
                            </Flex>
                        ))}
                    </Flex>
                </Flex>
            </Container>
        </Section>
    );
};

export default HeroSection;
