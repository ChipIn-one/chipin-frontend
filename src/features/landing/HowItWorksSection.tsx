import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Avatar, Box, Container, Flex, Heading, Section, Text } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

const STEP_KEYS = ['step1', 'step2', 'step3', 'step4'] as const;

const TimelineWrap = styled.div`
    position: relative;
    max-width: 560px;
    margin: 0 auto;
`;

const StepLine = styled.div`
    width: 2px;
    flex: 1;
    min-height: var(--space-9);
    background-color: ${themeColor('green6')};
    margin-top: var(--space-2);
    margin-bottom: var(--space-2);
`;

const HowItWorksSection = () => {
    const { t } = useTranslation('landing');

    return (
        <Section id="how-it-works" py="8">
            <Container size="2">
                <Flex direction="column" align="center" gap="3" mb="9">
                    <Text size="2" color="green" weight="medium">
                        {t('howItWorks.eyebrow')}
                    </Text>
                    <Heading align="center" size={{ initial: '7', md: '9' }}>
                        {t('howItWorks.title')}
                    </Heading>
                    <Text align="center" as="p" color="gray" size={{ initial: '3', sm: '4' }}>
                        {t('howItWorks.subtitle')}
                    </Text>
                </Flex>

                <TimelineWrap>
                    {STEP_KEYS.map((stepKey, index) => {
                        const isLast = index === STEP_KEYS.length - 1;
                        const label = String(index + 1).padStart(2, '0');

                        return (
                            <Flex key={stepKey} gap="5" align="start">
                                <Flex direction="column" align="center" flexShrink="0">
                                    <Avatar
                                        radius="full"
                                        size="4"
                                        color="green"
                                        variant="soft"
                                        fallback={label}
                                    />
                                    {!isLast && <StepLine />}
                                </Flex>
                                <Box pb={isLast ? '0' : '7'}>
                                    <Heading size="4" mb="1">
                                        {t(`howItWorks.${stepKey}.title`)}
                                    </Heading>
                                    <Text as="p" size="3" color="gray">
                                        {t(`howItWorks.${stepKey}.description`)}
                                    </Text>
                                </Box>
                            </Flex>
                        );
                    })}
                </TimelineWrap>
            </Container>
        </Section>
    );
};

export default HowItWorksSection;
