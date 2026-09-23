import { LucideClock3, LucideCrown, LucideSparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import styled from 'styled-components';

import { Button, Flex, Text } from '@radix-ui/themes';

import { useLandingStatsStore } from 'store/landing-stats-store';

import Footer from 'components/Footer';
import { BaseModal } from 'components/modals';
import {
    CtaSection,
    FeaturesSection,
    HeroSection,
    HowItWorksSection,
    ShowcaseSections,
} from 'features/landing';

const PROMO_COPY = {
    label: 'EARLY SUPPORTER',
    title: 'You’re #1–5,000',
    intro: 'Thank you for being with ChipIn early.',
    benefit: 'Premium is yours for 1 year — free.',
    expires: 'Expires on Sep 13, 2027',
    button: 'Thank you',
} as const;

const PromoStack = styled(Flex)`
    padding: 4px 8px 8px;
    text-align: center;
`;

const CrownStage = styled.div`
    position: relative;
    display: grid;
    width: 180px;
    height: 112px;
    margin: 0 auto 10px;
    place-items: center;
`;

const CrownCircle = styled.div`
    display: grid;
    width: 104px;
    height: 104px;
    place-items: center;
    border: 3px solid #e9bd45;
    border-radius: 50%;
    box-shadow:
        0 0 20px rgb(233 189 69 / 28%),
        inset 0 0 20px rgb(233 189 69 / 10%);
    color: #f6d36d;
`;

const Sparkle = styled(LucideSparkles)<{ $side: 'left' | 'right' }>`
    position: absolute;
    top: ${({ $side }) => ($side === 'left' ? '42px' : '31px')};
    ${({ $side }) => ($side === 'left' ? 'left: 3px;' : 'right: 0;')}
    color: #f0c54f;
    filter: drop-shadow(0 0 8px rgb(240 197 79 / 45%));
`;

const PromoLabel = styled(Text)`
    && {
        color: #f0c850;
        font-size: 20px;
        font-weight: 800;
        letter-spacing: 0.14em;
    }

    @media (max-width: 640px) {
        && {
            font-size: 15px;
        }
    }
`;

const PromoTitle = styled(Text)`
    && {
        margin: 12px 0 14px;
        color: var(--gray-12);
        font-size: clamp(34px, 6vw, 48px);
        font-weight: 800;
        line-height: 1.05;
        letter-spacing: -0.035em;
    }
`;

const PromoCopy = styled(Text)`
    && {
        max-width: 580px;
        margin: 0 auto;
        color: var(--gray-11);
        font-size: clamp(18px, 3vw, 24px);
        line-height: 1.45;
    }
`;

const ExpiryPill = styled.div`
    display: flex;
    width: fit-content;
    margin: 28px auto 20px;
    padding: 14px 20px;
    align-items: center;
    gap: 12px;
    border: 1px solid var(--gray-a4);
    border-radius: 14px;
    background: var(--gray-a3);
    color: var(--gray-11);
    font-size: 18px;

    @media (max-width: 640px) {
        margin-top: 22px;
        padding: 12px 16px;
        font-size: 15px;
    }
`;

const ThankYouButton = styled(Button)`
    && {
        width: 100%;
        height: 56px;
        border-radius: 14px;
        background: linear-gradient(90deg, #f6d36d 0%, #efbe43 100%);
        box-shadow: 0 10px 28px rgb(225 176 47 / 18%);
        color: #111;
        font-size: 20px;
        font-weight: 800;
    }

    &&:hover {
        background: linear-gradient(90deg, #f8dc82 0%, #f3c959 100%);
    }
`;

const EarlySupporterPreviewModal = () => {
    const [isOpen, setIsOpen] = useState(true);

    const content = (
        <PromoStack direction="column" align="center">
            <CrownStage>
                <Sparkle $side="left" size={24} />
                <CrownCircle>
                    <LucideCrown size={54} fill="currentColor" strokeWidth={1.8} />
                </CrownCircle>
                <Sparkle $side="right" size={27} />
            </CrownStage>

            <PromoLabel>{PROMO_COPY.label}</PromoLabel>
            <PromoTitle>{PROMO_COPY.title}</PromoTitle>
            <PromoCopy>
                {PROMO_COPY.intro}
                <br />
                {PROMO_COPY.benefit}
            </PromoCopy>

            <ExpiryPill>
                <LucideClock3 size={24} />
                {PROMO_COPY.expires}
            </ExpiryPill>

            <ThankYouButton size="4" onClick={() => setIsOpen(false)}>
                {PROMO_COPY.button}
            </ThankYouButton>
        </PromoStack>
    );

    return (
        <BaseModal
            title=""
            accessibleDescription={PROMO_COPY.benefit}
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
