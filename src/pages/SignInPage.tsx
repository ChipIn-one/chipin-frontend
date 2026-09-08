import { LucideArrowLeftRight, LucideReceiptText, LucideUsers2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Container, Flex, Grid, Heading, Section, Text } from '@radix-ui/themes';

import AuthButtons from 'components/AuthButtons';
import Footer from 'components/Footer';

// TODO: Make sign in content importable to other pages, ensure for not changing routes after sign in
const SignInPage = () => {
    const { t } = useTranslation('auth');

    return (
        <>
            <Section px="4" py="6" minHeight="75vh">
                <Container size="2">
                    <Flex direction="column" align="center" gap="9">
                        <Flex direction="column" align="center" gap="2">
                            <Heading size="8" align="center">
                                {t('signIn.title')}
                            </Heading>
                            <Text size="3" color="gray" align="center">
                                {t('signIn.subtitle')}
                            </Text>
                        </Flex>

                        <Grid columns="3" gap="3" width="100%">
                            <Card>
                                <Flex direction="column" align="center" gap="2" py="1">
                                    <Avatar
                                        size="2"
                                        variant="soft"
                                        color="green"
                                        fallback={<LucideUsers2 size={14} />}
                                    />
                                    <Text size="2" weight="medium" align="center">
                                        {t('signIn.features.groups')}
                                    </Text>
                                    <Text size="1" color="gray" align="center">
                                        {t('signIn.features.groupsDesc')}
                                    </Text>
                                </Flex>
                            </Card>

                            <Card>
                                <Flex direction="column" align="center" gap="2" py="1">
                                    <Avatar
                                        size="2"
                                        variant="soft"
                                        color="blue"
                                        fallback={<LucideReceiptText size={14} />}
                                    />
                                    <Text size="2" weight="medium" align="center">
                                        {t('signIn.features.balances')}
                                    </Text>
                                    <Text size="1" color="gray" align="center">
                                        {t('signIn.features.balancesDesc')}
                                    </Text>
                                </Flex>
                            </Card>

                            <Card>
                                <Flex direction="column" align="center" gap="2" py="1">
                                    <Avatar
                                        size="2"
                                        variant="soft"
                                        color="violet"
                                        fallback={<LucideArrowLeftRight size={14} />}
                                    />
                                    <Text size="2" weight="medium" align="center">
                                        {t('signIn.features.settleUp')}
                                    </Text>
                                    <Text size="1" color="gray" align="center">
                                        {t('signIn.features.settleUpDesc')}
                                    </Text>
                                </Flex>
                            </Card>
                        </Grid>

                        <AuthButtons />
                    </Flex>
                </Container>
            </Section>

            <Footer />
        </>
    );
};

export default SignInPage;
