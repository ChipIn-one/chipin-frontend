import { LucideArrowRight, LucideDownload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge, Box, Button, Container, Flex, Heading, Section, Text } from '@radix-ui/themes';

import { usePwaStore } from 'store/pwaStore';

import { AuthModal } from 'components/modals';

import { LandingStats } from './components';

const HeroSection = () => {
    const isPwaInstalled = usePwaStore(state => state.isPwaInstalled);
    const isPwaInstallable = usePwaStore(state => state.isPwaInstallable);
    const callPWAInstall = usePwaStore(state => state.callPWAInstall);
    const { t } = useTranslation('landing');

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

                    <LandingStats />
                </Flex>
            </Container>
        </Section>
    );
};

export default HeroSection;
