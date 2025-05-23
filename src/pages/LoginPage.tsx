import { Box, Button, Card, Container, Flex, Text } from '@radix-ui/themes';

const LoginPage = () => {
    return (
        <Box height="100%">
            <Container size="3">
                <Card>
                    <Flex gap="3" align="center">
                        <Button size="4">Sign in with Google</Button>
                    </Flex>
                </Card>
            </Container>
        </Box>
    );
};

export default LoginPage;
