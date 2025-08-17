import { Box, Container, Flex, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';

const Footer = () => (
    <Box py="6" px="4">
        <Container size="3">
            <Flex justify="center">
                <Text size="3" color="gray">
                    © {PROJECT_NAME} {new Date().getFullYear()}. All rights reserved.
                </Text>
            </Flex>
        </Container>
    </Box>
);

export default Footer;
