import styled from 'styled-components';

import { Box, Button, Card, Container, Flex, Heading } from '@radix-ui/themes';

const FullHeightCenter = styled(Box)`
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const StyledCard = styled(Card)`
    width: 100%;
    max-width: 360px;
    padding: 24px;
    text-align: center;
`;

const LoginButton = styled(Button)`
    width: 100%;
    justify-content: start;
    gap: 12px;
`;

const LoginPage = () => {
    return (
        <FullHeightCenter>
            <Container size="3">
                <Flex direction="column" gap="4" align="center">
                    <Heading size="6">Sign in to your account</Heading>
                    <StyledCard>
                        <Flex direction="column" gap="3">
                            <LoginButton size="3" variant="classic">
                                {/* <FcGoogle size={20} /> */}
                                Sign in with Google
                            </LoginButton>
                            <LoginButton size="3" variant="classic">
                                {/* <AppleIcon size={20} /> */}
                                Sign in with Apple
                            </LoginButton>
                        </Flex>
                    </StyledCard>
                </Flex>
            </Container>
        </FullHeightCenter>
    );
};

export default LoginPage;
