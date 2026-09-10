import { useTranslation } from 'react-i18next';

import { Container, Flex, Heading, Section, Text } from '@radix-ui/themes';

import Footer from 'components/Footer';

const PrivacyPage = () => {
    const { t } = useTranslation();

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
                        </Flex>

                        <Flex direction="column" gap="5">
                            <Flex direction="column" gap="2">
                                <Heading as="h2" size="5">
                                    {t('legal.privacy.account.title')}
                                </Heading>
                                <Text size="3">{t('legal.privacy.account.body')}</Text>
                            </Flex>
                            <Flex direction="column" gap="2">
                                <Heading as="h2" size="5">
                                    {t('legal.privacy.expenseData.title')}
                                </Heading>
                                <Text size="3">{t('legal.privacy.expenseData.body')}</Text>
                            </Flex>
                            <Flex direction="column" gap="2">
                                <Heading as="h2" size="5">
                                    {t('legal.privacy.sessions.title')}
                                </Heading>
                                <Text size="3">{t('legal.privacy.sessions.body')}</Text>
                            </Flex>
                            <Flex direction="column" gap="2">
                                <Heading as="h2" size="5">
                                    {t('legal.privacy.operations.title')}
                                </Heading>
                                <Text size="3">{t('legal.privacy.operations.body')}</Text>
                            </Flex>
                            <Flex direction="column" gap="2">
                                <Heading as="h2" size="5">
                                    {t('legal.privacy.updates.title')}
                                </Heading>
                                <Text size="3">{t('legal.privacy.updates.body')}</Text>
                            </Flex>
                        </Flex>
                    </Flex>
                </Container>
            </Section>

            <Footer />
        </>
    );
};

export default PrivacyPage;
