import { Box, Flex } from '@radix-ui/themes';
import type { ReactNode } from 'react';

import { DESKTOP_SHELL_MAX_WIDTH, DesktopSidebar, MobileNavBar } from 'components/nav-bars';
import { OfflineBanner } from 'components/offline-banner';

interface Props {
    children: ReactNode;
    /** The outbox badge, banner and sheet (03-16a part B), passed in by the app layer. */
    outbox?: ReactNode;
}

const InternalPageLayout = ({ children, outbox }: Props) => (
    <>
        <Box maxWidth={DESKTOP_SHELL_MAX_WIDTH} mx="auto" py={{ lg: '4' }}>
            <Flex gap={{ lg: '6' }}>
                <DesktopSidebar />

                <Box flexGrow="1" minWidth="0">
                    <OfflineBanner />
                    {outbox}
                    {children}
                </Box>
            </Flex>
        </Box>

        <MobileNavBar />
    </>
);

export default InternalPageLayout;
