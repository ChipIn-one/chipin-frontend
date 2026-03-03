import { Box, Container, Flex, Separator, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';

const Footer = () => (
    <Box py="6" px="4">
        <Separator orientation="horizontal" size="4" mb="4" />
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
