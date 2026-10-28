import { LucideArrowRight, LucideCheckCircle, LucideDownload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge, Box, Button, Container, Flex, Heading, Section, Text } from '@radix-ui/themes';

import { usePwaStore } from 'store/pwaStore';

import { AuthModal } from 'components/modals/auth-modal';

import { CTA_BULLET_KEYS } from './internal';
import { CtaCard } from './styled';

const CtaSection = () => {
    const { t } = useTranslation('landing');
    const isPwaInstalled = usePwaStore(state => state.isPwaInstalled);
    const pwaInstallPrompt = usePwaStore(state => state.pwaInstallPrompt);
    const callPWAInstall = usePwaStore(state => state.callPWAInstall);

    const secondaryAction = !isPwaInstalled && pwaInstallPrompt !== null && (
        <Button
            size={{ initial: '3', sm: '4' }}
            variant="soft"
            color="gray"
            onClick={callPWAInstall}
        >
            {t('common:buttons.installApp')}
            <LucideDownload />
        </Button>
    );

    return (
        <Section id="pricing" py="8">
            <Container size="2">
                <CtaCard size={{ initial: '3', sm: '5' }}>
                    <Flex direction="column" align="center" gap="5">
                        <Badge color="green" variant="surface" radius="full" size="3">
                            {t('cta.badge')}
                        </Badge>

                        <Heading align="center" size={{ initial: '6', md: '8' }}>
                            {t('cta.title')}
                        </Heading>

                        <Box maxWidth="480px">
                            <Text
                                align="center"
                                as="p"
                                color="gray"
                                size={{ initial: '3', sm: '4' }}
                            >
                                {t('cta.subtitle')}
                            </Text>
                        </Box>

                        <Flex direction={{ initial: 'column', sm: 'row' }} gap="3" justify="center">
                            <AuthModal>
                                <Button size={{ initial: '3', sm: '4' }} variant="solid" color="green">
                                    {t('cta.getStartedFree')}
                                    <LucideArrowRight />
                                </Button>
                            </AuthModal>
                            {secondaryAction}
                        </Flex>

                        <Flex wrap="wrap" gap="4" justify="center">
                            {CTA_BULLET_KEYS.map(bulletKey => (
                                <Flex key={bulletKey} align="center" gap="1">
                                    <Text color="green" size="3">
                                        <LucideCheckCircle size={16} />
                                    </Text>
                                    <Text size="3" color="gray">
                                        {t(`cta.bullets.${bulletKey}`)}
                                    </Text>
                                </Flex>
                            ))}
                        </Flex>
                    </Flex>
                </CtaCard>
            </Container>
        </Section>
    );
};

export default CtaSection;
