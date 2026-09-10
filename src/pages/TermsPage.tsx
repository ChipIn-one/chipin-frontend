import { useTranslation } from 'react-i18next';

import { Container, Flex, Heading, Section, Text } from '@radix-ui/themes';

import Footer from 'components/Footer';

const TermsPage = () => {
    const { t } = useTranslation();

    return (
        <>
            <Section px="4" py="6" minHeight="75vh" aria-labelledby="terms-page-title">
                <Container size="3">
                    <Flex direction="column" gap="6">
                        <Flex direction="column" gap="2">
                            <Heading id="terms-page-title" size="8">
                                {t('legal.terms.title')}
                            </Heading>
                            <Text size="3" color="gray">
                                {t('legal.terms.intro')}
                            </Text>
                        </Flex>

                        <Flex direction="column" gap="5">
                            <Flex direction="column" gap="2">
                                <Heading as="h2" size="5">
                                    {t('legal.terms.productUse.title')}
                                </Heading>
                                <Text size="3">{t('legal.terms.productUse.body')}</Text>
                            </Flex>
                            <Flex direction="column" gap="2">
                                <Heading as="h2" size="5">
                                    {t('legal.terms.responsibility.title')}
                                </Heading>
                                <Text size="3">{t('legal.terms.responsibility.body')}</Text>
                            </Flex>
                            <Flex direction="column" gap="2">
                                <Heading as="h2" size="5">
                                    {t('legal.terms.records.title')}
                                </Heading>
                                <Text size="3">{t('legal.terms.records.body')}</Text>
                            </Flex>
                            <Flex direction="column" gap="2">
                                <Heading as="h2" size="5">
                                    {t('legal.terms.appropriateUse.title')}
                                </Heading>
                                <Text size="3">{t('legal.terms.appropriateUse.body')}</Text>
                            </Flex>
                            <Flex direction="column" gap="2">
                                <Heading as="h2" size="5">
                                    {t('legal.terms.changes.title')}
                                </Heading>
                                <Text size="3">{t('legal.terms.changes.body')}</Text>
                            </Flex>
                        </Flex>
                    </Flex>
                </Container>
            </Section>

            <Footer />
        </>
    );
};

export default TermsPage;
