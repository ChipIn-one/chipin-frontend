import { Box, Container, Flex, Spinner } from '@radix-ui/themes';

const PageLoader = () => {
    return (
        <Box>
            <Container size="4">
                <Flex justify="center" align="center" minHeight="100vh">
                    <Spinner size="3" />
                </Flex>
            </Container>
        </Box>
    );
};

export default PageLoader;
