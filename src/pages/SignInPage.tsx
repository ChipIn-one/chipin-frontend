import { Container, Flex, Heading, Section } from '@radix-ui/themes';

import AuthButtons from 'components/AuthButtons';
import Footer from 'components/Footer';

// TODO: Make sign in content importable to other pages, ensure for not changing routes after sign in
const SignInPage = () => {
    return (
        <>
            <Section px="4" py="6" minHeight="75vh">
                <Container size="3">
                    <Flex direction="column" align="center" gap="5">
                        <Heading size="9">Welcome back</Heading>
                        <Heading size="5" color="gray" align="center" mb="9">
                            Sign in to your account to access your groups, manage your bills, and
                            stay connected.
                        </Heading>

                        <AuthButtons />
                    </Flex>
                </Container>
            </Section>

            <Footer />
        </>
    );
};

export default SignInPage;
