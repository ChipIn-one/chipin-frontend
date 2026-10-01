import { useTranslation } from 'react-i18next';

import { Box, Container, Flex, Heading, Link, Section, Text } from '@radix-ui/themes';

import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import Footer from 'components/Footer';
import { MobileNavBar } from 'components/nav-bars';

const PRIVACY_CONTACT_EMAIL = 'privacy@chipin.one';

const PRIVACY_SECTIONS = [
    'account',
    'googleSignIn',
    'expenseData',
    'sessions',
    'sharing',
    'operations',
    'retention',
    'updates',
] as const;

const PrivacyPage = () => {
    const { t } = useTranslation();
    const isLoggedIn = useAuthStore(selectIsLoggedIn);

    return (
        <>
            <Section px="4" py="6" minHeight="75vh" aria-labelledby="privacy-page-title">
                <Container size="3">
                    <Flex direction="column" gap="6">
                        <Flex direction="column" gap="2">
                            <Heading id="privacy-page-title" size="8">
                                {t('legal.privacy.title')}
                            </Heading>
                            <Text size="3" color="gray">
                                {t('legal.privacy.intro')}
                            </Text>
                            <Text size="2" color="gray">
                                {t('legal.privacy.effectiveDate')}
                            </Text>
                        </Flex>

                        <Flex direction="column" gap="5">
                            {PRIVACY_SECTIONS.map((sectionKey) => (
                                <Flex key={sectionKey} direction="column" gap="2">
                                    <Heading as="h2" size="5">
                                        {t(`legal.privacy.${sectionKey}.title`)}
                                    </Heading>
                                    <Text size="3">{t(`legal.privacy.${sectionKey}.body`)}</Text>
                                </Flex>
                            ))}
                            <Flex direction="column" gap="2">
                                <Heading as="h2" size="5">
                                    {t('legal.privacy.contact.title')}
                                </Heading>
                                <Text size="3">
                                    {t('legal.privacy.contact.body')}{' '}
                                    <Link href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>
                                        {PRIVACY_CONTACT_EMAIL}
                                    </Link>
                                </Text>
                            </Flex>
                        </Flex>
                    </Flex>
                </Container>
            </Section>

            <Box
                data-testid="legal-page-footer"
                pb={isLoggedIn ? { initial: '9', sm: '0' } : undefined}
            >
                <Footer />
            </Box>
            {isLoggedIn && <MobileNavBar />}
        </>
    );
};

export default PrivacyPage;
