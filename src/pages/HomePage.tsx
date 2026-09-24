import { LucideClock3, LucideCrown, LucideSparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Avatar, Badge, Button, Flex, Heading, Text } from '@radix-ui/themes';

import { MEDIA_QUERIES } from 'constants/breakpoints';
import { useLandingStatsStore } from 'store/landing-stats-store';

import Footer from 'components/Footer';
import { BaseModal } from 'components/modals';
import { OverlayBody, OverlayFooter } from 'components/modals/components';
import {
    CtaSection,
    FeaturesSection,
    HeroSection,
    HowItWorksSection,
    ShowcaseSections,
} from 'features/landing';

const ThankYouButton = styled(Button)`
    @media ${MEDIA_QUERIES.belowSm} {
        && {
            grid-column: 1 / -1;
        }
    }
`;

const EarlySupporterPreviewModal = () => {
    const { t } = useTranslation('landing');
    const [isOpen, setIsOpen] = useState(true);

    const thankYouAction = (
        <ThankYouButton size="3" color="amber" highContrast onClick={() => setIsOpen(false)}>
            {t('promo.button')}
        </ThankYouButton>
    );

    const content = (
        <>
            <OverlayBody>
                <Flex
                    direction="column"
                    align="center"
                    justify="center"
                    gap="4"
                    height="100%"
                    py={{ initial: '2', sm: '0' }}
                >
                    <Flex align="center" justify="center" gap="3">
                        <Text color="amber">
                            <LucideSparkles size={20} />
                        </Text>
                        <Avatar
                            size="8"
                            color="amber"
                            variant="soft"
                            radius="full"
                            fallback={<LucideCrown size={36} />}
                        />
                        <Text color="amber">
                            <LucideSparkles size={22} />
                        </Text>
                    </Flex>

                    <Flex direction="column" align="center" gap="2">
                        <Text
                            color="amber"
                            size={{ initial: '2', sm: '3' }}
                            weight="bold"
                            align="center"
                        >
                            {t('promo.label')}
                        </Text>
                        <Heading
                            as="h2"
                            size={{ initial: '7', sm: '8' }}
                            weight="bold"
                            align="center"
                        >
                            {t('promo.title')}
                        </Heading>
                    </Flex>

                    <Flex direction="column" align="center" gap="1">
                        <Text color="gray" size={{ initial: '3', sm: '4' }} align="center">
                            {t('promo.intro')}
                        </Text>
                        <Text color="gray" size={{ initial: '3', sm: '4' }} align="center">
                            {t('promo.benefit')}
                        </Text>
                    </Flex>

                    <Badge size="3" color="gray" variant="surface" radius="full">
                        <Flex align="center" gap="2">
                            <LucideClock3 size={16} />
                            {t('promo.expires')}
                        </Flex>
                    </Badge>
                </Flex>
            </OverlayBody>

            <OverlayFooter cancelAction={null} primaryAction={thankYouAction} />
        </>
    );

    return (
        <BaseModal
            title={t('promo.modalTitle')}
            accessibleDescription={t('promo.benefit')}
            maxWidth="680px"
            content={content}
            isOpened={isOpen}
            setIsOpened={setIsOpen}
        />
    );
};

const HomePage = () => {
    const fetchSetStats = useLandingStatsStore(state => state.fetchSetStats);

    useEffect(() => {
        fetchSetStats();
    }, [fetchSetStats]);

    return (
        <>
            {/* Temporary visual-only promo preview for issue #221. */}
            <EarlySupporterPreviewModal />
            <HeroSection />
            <FeaturesSection />

            <ShowcaseSections />
            <HowItWorksSection />
            <CtaSection />
            <Footer />
        </>
    );
};

export default HomePage;
