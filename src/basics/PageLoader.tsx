import { Box, Container, Flex } from '@radix-ui/themes';

import ChipInLoader from './ChipInLoader';

const PageLoader = () => {
    return (
        <Box>
            <Container size="4">
                <Flex justify="center" align="center" minHeight="100vh">
                    <ChipInLoader />
                </Flex>
            </Container>
        </Box>
    );
};

export default PageLoader;
