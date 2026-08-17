import { LucideArrowRight, LucideCheckCircle, LucideDownload } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, Box, Button, Container, Flex, Heading, Section, Text } from '@radix-ui/themes';

import { useAppNavigate } from 'hooks/useAppNavigate';
import { usePwaStore } from 'store/pwaStore';

import { AuthModal } from 'components/modals';

import { CTA_BULLET_KEYS } from './internal';
import { CtaCard } from './styled';

const CtaSection = () => {
    const { t } = useTranslation('landing');
    const navigate = useAppNavigate();
    const isPwaInstalled = usePwaStore(state => state.isPwaInstalled);
    const pwaInstallPrompt = usePwaStore(state => state.pwaInstallPrompt);
    const callPWAInstall = usePwaStore(state => state.callPWAInstall);

    let secondaryAction: ReactNode;

    if (isPwaInstalled) {
        secondaryAction = (
            <Button size="4" variant="soft" color="gray" onClick={() => navigate('/dashboard')}>
                {t('cta.openApp')}
            </Button>
        );
    } else if (pwaInstallPrompt !== null) {
        secondaryAction = (
            <Button size="4" variant="soft" color="gray" onClick={callPWAInstall}>
                {t('common:buttons.installApp')}
                <LucideDownload />
            </Button>
        );
    } else {
        secondaryAction = (
            <AuthModal>
                <Button size="4" variant="soft" color="gray">
                    {t('cta.openApp')}
                </Button>
            </AuthModal>
        );
    }

    return (
        <Section id="pricing" py="8">
            <Container size="2">
                <CtaCard size="4">
                    <Flex direction="column" align="center" gap="5">
                        <Badge color="green" variant="surface" radius="full">
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
                                <Button size="4" variant="solid" color="green">
                                    {t('cta.getStartedFree')}
                                    <LucideArrowRight />
                                </Button>
                            </AuthModal>
                            {secondaryAction}
                        </Flex>

                        <Flex wrap="wrap" gap="4" justify="center">
                            {CTA_BULLET_KEYS.map(bulletKey => (
                                <Flex key={bulletKey} align="center" gap="1">
                                    <Text color="green" size="2">
                                        <LucideCheckCircle size={14} />
                                    </Text>
                                    <Text size="2" color="gray">
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
