import { LucideArrowRight, LucideCheckCircle, LucideDownload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import {
    Badge,
    Box,
    Button,
    Card,
    Container,
    Flex,
    Heading,
    Section,
    Text,
} from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';
import { useAppNavigate } from 'hooks/useAppNavigate';
import { usePwaStore } from 'store/pwaStore';

import { AuthModal } from 'components/modals';

const CtaCard = styled(Card)`
    background: radial-gradient(
        circle at 50% -10%,
        ${themeColor('green5')} 0%,
        ${themeColor('green2')} 55%
    );
    padding: var(--space-8);
    overflow: hidden;
`;

const CtaSection = () => {
    const { t } = useTranslation('landing');
    const navigate = useAppNavigate();
    const isPwaInstalled = usePwaStore(s => s.isPwaInstalled);
    const pwaInstallPrompt = usePwaStore(s => s.pwaInstallPrompt);
    const { callPWAInstall } = usePwaStore();

    const bullets = [
        t('cta.bullets.noCard'),
        t('cta.bullets.unlimitedGroups'),
        t('cta.bullets.freePermanently'),
        t('cta.bullets.allDevices'),
    ];

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
                            {isPwaInstalled ? (
                                <Button
                                    size="4"
                                    variant="soft"
                                    color="gray"
                                    onClick={() => navigate('/dashboard')}
                                >
                                    {t('cta.openApp')}
                                </Button>
                            ) : pwaInstallPrompt !== null ? (
                                <Button
                                    size="4"
                                    variant="soft"
                                    color="gray"
                                    onClick={callPWAInstall}
                                >
                                    {t('common:buttons.installApp')}
                                    <LucideDownload />
                                </Button>
                            ) : (
                                !isPwaInstalled && (
                                    <AuthModal>
                                        <Button size="4" variant="soft" color="gray">
                                            {t('cta.openApp')}
                                        </Button>
                                    </AuthModal>
                                )
                            )}
                        </Flex>

                        <Flex wrap="wrap" gap="4" justify="center">
                            {bullets.map(bullet => (
                                <Flex key={bullet} align="center" gap="1">
                                    <Text color="green" size="2">
                                        <LucideCheckCircle size={14} />
                                    </Text>
                                    <Text size="2" color="gray">
                                        {bullet}
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
