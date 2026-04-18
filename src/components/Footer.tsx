import { Box, Container, Flex, Separator, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';

const Footer = () => (
    <Box py="4">
        <Flex direction="column" gap="3">
            <Separator orientation="horizontal" size="4" />
            <Container size="3">
                <Flex justify="center">
                    <Text size="3" color="gray">
                        © {PROJECT_NAME} {new Date().getFullYear()}. All rights reserved.
                    </Text>
                </Flex>
            </Container>
        </Flex>
    </Box>
);

export default Footer;
