import { LucideClock3, LucideCrown, LucideSparkles, LucideX } from 'lucide-react';
import { useEffect, useState } from 'react';
import styled from 'styled-components';

import { Button, Dialog, Flex, IconButton, Text } from '@radix-ui/themes';

import { useLandingStatsStore } from 'store/landing-stats-store';

import Footer from 'components/Footer';
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

const PromoDialogContent = styled(Dialog.Content)`
    && {
        width: min(760px, calc(100vw - 32px));
        max-width: 760px;
        padding: 36px 42px 42px;
        overflow: hidden;
        border: 1px solid rgb(255 255 255 / 18%);
        border-radius: 28px;
        background:
            radial-gradient(circle at 50% -5%, rgb(222 177 55 / 25%), transparent 42%),
            linear-gradient(180deg, #151819 0%, #0b1012 100%);
        box-shadow: 0 30px 90px rgb(0 0 0 / 58%);
        color: #f7f7f5;
    }

    @media (max-width: 640px) {
        && {
            padding: 30px 20px 24px;
            border-radius: 22px;
        }
    }
`;

const CloseButton = styled(IconButton)`
    && {
        position: absolute;
        top: 18px;
        right: 18px;
        color: #c8c9c9;
    }
`;

const PromoStack = styled(Flex)`
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

const PromoTitle = styled(Dialog.Title)`
    && {
        margin: 12px 0 14px;
        color: #f8f8f6;
        font-size: clamp(34px, 6vw, 48px);
        font-weight: 800;
        line-height: 1.05;
        letter-spacing: -0.035em;
    }
`;

const PromoCopy = styled(Dialog.Description)`
    && {
        max-width: 580px;
        margin: 0 auto;
        color: #d5d5d2;
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
    border: 1px solid rgb(255 255 255 / 6%);
    border-radius: 14px;
    background: rgb(255 255 255 / 4%);
    color: #d7d7d4;
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
        height: 64px;
        border-radius: 15px;
        background: linear-gradient(90deg, #f6d36d 0%, #efbe43 100%);
        box-shadow: 0 10px 28px rgb(225 176 47 / 18%);
        color: #111;
        font-size: 22px;
        font-weight: 800;
    }

    &&:hover {
        background: linear-gradient(90deg, #f8dc82 0%, #f3c959 100%);
    }
`;

const EarlySupporterPreviewModal = () => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
            <PromoDialogContent>
                <Dialog.Close>
                    <CloseButton variant="ghost" aria-label="Close">
                        <LucideX size={28} />
                    </CloseButton>
                </Dialog.Close>

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
                        Thank you for being with ChipIn early.
                        <br />
                        Premium is yours for 1 year — free.
                    </PromoCopy>

                    <ExpiryPill>
                        <LucideClock3 size={24} />
                        {PROMO_COPY.expires}
                    </ExpiryPill>

                    <Dialog.Close>
                        <ThankYouButton size="4">{PROMO_COPY.button}</ThankYouButton>
                    </Dialog.Close>
                </PromoStack>
            </PromoDialogContent>
        </Dialog.Root>
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
