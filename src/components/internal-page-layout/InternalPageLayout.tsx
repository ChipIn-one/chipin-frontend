import type { ReactNode } from 'react';

import { Box, Flex } from '@radix-ui/themes';

import { DESKTOP_SHELL_MAX_WIDTH, DesktopSidebar } from 'components/nav-bars';

interface Props {
    children: ReactNode;
}

const InternalPageLayout = ({ children }: Props) => (
    <Box maxWidth={DESKTOP_SHELL_MAX_WIDTH} mx="auto" py={{ lg: '4' }}>
        <Flex gap={{ lg: '6' }}>
            <Box flexGrow="1" minWidth="0">
                {children}
            </Box>

            <DesktopSidebar />
        </Flex>
    </Box>
);

export default InternalPageLayout;
