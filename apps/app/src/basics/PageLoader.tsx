import { Box, Container, Flex } from '@radix-ui/themes';
import type { ReactNode } from 'react';

import { ChipInLoader } from './ChipInLoader';

interface Props {
    /** Shown under the loader, e.g. a `role="status"` line that says what is loading. */
    children?: ReactNode;
}

const PageLoader = ({ children }: Props) => {
    return (
        <Box>
            <Container size="4">
                <Flex direction="column" justify="center" align="center" gap="3" minHeight="100vh">
                    <ChipInLoader />
                    {children}
                </Flex>
            </Container>
        </Box>
    );
};

export { PageLoader };
