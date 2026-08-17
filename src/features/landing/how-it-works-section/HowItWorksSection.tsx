import { useTranslation } from 'react-i18next';

import { Avatar, Box, Container, Flex, Heading, Section, Text } from '@radix-ui/themes';

import { STEP_KEYS } from './internal';
import { StepLine, TimelineWrap } from './styled';

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
